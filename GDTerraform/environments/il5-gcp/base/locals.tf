data "google_project" "current" {
  project_id = var.project_id
}

locals {
  name_prefix = "gameday-${var.environment}"
  project_number = data.google_project.current.number

  common_labels = {
    environment = var.environment
    project     = "gameday"
    managed-by  = "terraform"
  }

  # Service agent emails for CMEK key grants
  gke_service_agent    = "service-${local.project_number}@container-engine-robot.iam.gserviceaccount.com"
  sql_service_agent    = "service-${local.project_number}@gcp-sa-cloud-sql.iam.gserviceaccount.com"
  gcs_service_agent    = "service-${local.project_number}@gs-project-accounts.iam.gserviceaccount.com"
  ar_service_agent     = "service-${local.project_number}@gcp-sa-artifactregistry.iam.gserviceaccount.com"
  compute_service_agent = "service-${local.project_number}@compute-system.iam.gserviceaccount.com"
  sm_service_agent     = "service-${local.project_number}@gcp-sa-secretmanager.iam.gserviceaccount.com"
}
