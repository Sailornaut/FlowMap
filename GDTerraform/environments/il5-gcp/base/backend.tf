# ------------------------------------------------------------------------------
# State Backend — GCS
#
# Store Terraform state in a CMEK-encrypted GCS bucket.
# The state bucket must be created manually before first apply:
#   gsutil mb -l US -p <PROJECT_ID> gs://<STATE_BUCKET>/
#   gsutil versioning set on gs://<STATE_BUCKET>/
# ------------------------------------------------------------------------------

terraform {
  backend "gcs" {
    bucket = "<IL5_STATE_BUCKET>"
    prefix = "terraform/il5-gcp/base"
  }
}
