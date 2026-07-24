# ------------------------------------------------------------------------------
# Artifact Registry — IL5 CMEK Encrypted
#
# Equivalent to AWS ECR. Docker container registry with CMEK encryption,
# vulnerability scanning, and cleanup policies.
# ------------------------------------------------------------------------------

resource "google_artifact_registry_repository" "this" {
  for_each = var.repositories

  repository_id = each.key
  project       = var.project_id
  location      = var.location
  format        = "DOCKER"
  mode          = "STANDARD_REPOSITORY"
  description   = each.value.description

  kms_key_name = var.kms_key_id

  docker_config {
    immutable_tags = each.value.immutable_tags
  }

  dynamic "cleanup_policies" {
    for_each = each.value.cleanup_policies
    content {
      id     = cleanup_policies.value.id
      action = cleanup_policies.value.action

      dynamic "condition" {
        for_each = cleanup_policies.value.condition != null ? [cleanup_policies.value.condition] : []
        content {
          tag_state  = condition.value.tag_state
          older_than = condition.value.older_than
        }
      }

      dynamic "most_recent_versions" {
        for_each = cleanup_policies.value.keep_count != null ? [cleanup_policies.value.keep_count] : []
        content {
          keep_count = most_recent_versions.value
        }
      }
    }
  }

  labels = var.labels
}

# Enable vulnerability scanning on all repositories
resource "google_artifact_registry_repository_iam_member" "vulnerability_scanning" {
  for_each = var.vulnerability_scanning_sa != null ? var.repositories : {}

  project    = var.project_id
  location   = var.location
  repository = google_artifact_registry_repository.this[each.key].name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${var.vulnerability_scanning_sa}"
}
