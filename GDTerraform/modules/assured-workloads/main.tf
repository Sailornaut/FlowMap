# ------------------------------------------------------------------------------
# Assured Workloads — IL5 Folder
#
# Creates a GCP Assured Workloads environment that enforces IL5 (DoD Impact
# Level 5) controls: US-only data residency, CMEK requirements, org policy
# constraints, and resource location restrictions.
# ------------------------------------------------------------------------------

resource "google_assured_workloads_workload" "this" {
  display_name        = var.display_name
  organization        = var.organization_id
  location            = var.location
  compliance_regime   = "IL5"
  billing_account     = "billingAccounts/${var.billing_account_id}"
  provisioned_resources_parent = var.parent

  resource_settings {
    resource_type = "CONSUMER_FOLDER"
    display_name  = var.display_name
  }

  labels = var.labels
}
