# ------------------------------------------------------------------------------
# Secret Manager — IL5 CMEK Encrypted
#
# Equivalent to AWS Secrets Manager. Stores application secrets with
# CMEK encryption, automatic replication within US regions only,
# and IAM-based access control.
# ------------------------------------------------------------------------------

resource "google_secret_manager_secret" "this" {
  for_each = var.secrets

  secret_id = each.key
  project   = var.project_id

  replication {
    user_managed {
      replicas {
        location = var.location

        customer_managed_encryption {
          kms_key_name = var.kms_key_id
        }
      }
    }
  }

  labels = merge(var.labels, each.value.labels)
}

# Only create versions for secrets with values provided
resource "google_secret_manager_secret_version" "this" {
  for_each = { for k, v in var.secrets : k => v if v.value != null }

  secret      = google_secret_manager_secret.this[each.key].id
  secret_data = each.value.value
}

# IAM bindings for secret access
resource "google_secret_manager_secret_iam_member" "accessor" {
  for_each = var.secret_accessors

  project   = var.project_id
  secret_id = google_secret_manager_secret.this[each.value.secret_key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value.member
}
