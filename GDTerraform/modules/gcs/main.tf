# ------------------------------------------------------------------------------
# Google Cloud Storage — IL5 CMEK Encrypted
#
# Equivalent to AWS S3 with KMS encryption. Enforces uniform bucket-level
# access (no ACLs), versioning, and US-only location.
# ------------------------------------------------------------------------------

resource "google_storage_bucket" "this" {
  name          = var.bucket_name
  project       = var.project_id
  location      = var.location
  storage_class = var.storage_class
  force_destroy = var.force_destroy

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  encryption {
    default_kms_key_name = var.kms_key_id
  }

  dynamic "versioning" {
    for_each = var.versioning_enabled ? [1] : []
    content {
      enabled = true
    }
  }

  dynamic "lifecycle_rule" {
    for_each = var.lifecycle_rules
    content {
      condition {
        age = lifecycle_rule.value.age_days
      }
      action {
        type = lifecycle_rule.value.action
      }
    }
  }

  # Audit / access logging
  dynamic "logging" {
    for_each = var.log_bucket != null ? [1] : []
    content {
      log_bucket        = var.log_bucket
      log_object_prefix = var.log_object_prefix
    }
  }

  labels = var.labels
}
