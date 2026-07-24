# ------------------------------------------------------------------------------
# Remote state from base phase
# ------------------------------------------------------------------------------

data "terraform_remote_state" "base" {
  backend = "gcs"
  config = {
    bucket = "<IL5_STATE_BUCKET>"
    prefix = "terraform/il5-gcp/base"
  }
}

locals {
  base        = data.terraform_remote_state.base.outputs
  name_prefix = "gameday-${var.environment}"

  common_labels = {
    environment = var.environment
    project     = "gameday"
    managed-by  = "terraform"
  }
}
