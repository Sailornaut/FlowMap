# ------------------------------------------------------------------------------
# Cloud KMS — CMEK Key Rings and Crypto Keys
#
# IL5 requires CMEK for all data-at-rest. This module creates a key ring
# and multiple crypto keys for different services (GKE, Cloud SQL, GCS,
# Compute/disks, Secret Manager, Artifact Registry).
# ------------------------------------------------------------------------------

resource "google_kms_key_ring" "this" {
  name     = var.key_ring_name
  location = var.location
  project  = var.project_id
}

resource "google_kms_crypto_key" "this" {
  for_each = var.keys

  name            = each.key
  key_ring        = google_kms_key_ring.this.id
  rotation_period = each.value.rotation_period
  purpose         = each.value.purpose

  version_template {
    algorithm        = each.value.algorithm
    protection_level = each.value.protection_level
  }

  labels = var.labels

  lifecycle {
    prevent_destroy = true
  }
}

# Grant service agents access to use the CMEK keys
resource "google_kms_crypto_key_iam_member" "service_agent_bindings" {
  for_each = var.key_iam_bindings

  crypto_key_id = google_kms_crypto_key.this[each.value.key_name].id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = each.value.member
}
