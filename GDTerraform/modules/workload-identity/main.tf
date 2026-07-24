# ------------------------------------------------------------------------------
# Workload Identity — GCP equivalent of AWS IRSA
#
# Binds a Kubernetes service account to a GCP service account, allowing
# pods to authenticate to GCP services using Workload Identity Federation
# instead of node-level credentials.
# ------------------------------------------------------------------------------

# GCP Service Account
resource "google_service_account" "this" {
  account_id   = var.service_account_id
  display_name = var.display_name
  project      = var.project_id
  description  = var.description
}

# Bind the K8s SA → GCP SA via Workload Identity
resource "google_service_account_iam_member" "workload_identity" {
  service_account_id = google_service_account.this.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.k8s_namespace}/${var.k8s_service_account}]"
}

# IAM role bindings on the GCP SA
resource "google_project_iam_member" "roles" {
  for_each = toset(var.project_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.this.email}"
}

# Custom IAM bindings (for resource-level permissions)
resource "google_project_iam_member" "custom_bindings" {
  for_each = var.custom_iam_bindings

  project = var.project_id
  role    = each.value.role
  member  = "serviceAccount:${google_service_account.this.email}"

  dynamic "condition" {
    for_each = each.value.condition != null ? [each.value.condition] : []
    content {
      title       = condition.value.title
      description = condition.value.description
      expression  = condition.value.expression
    }
  }
}
