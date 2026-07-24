# ------------------------------------------------------------------------------
# Enable required GCP APIs
#
# IL5 Assured Workloads requires these APIs be enabled in the project.
# ------------------------------------------------------------------------------

resource "google_project_service" "apis" {
  for_each = toset([
    "assuredworkloads.googleapis.com",
    "compute.googleapis.com",
    "container.googleapis.com",
    "sqladmin.googleapis.com",
    "cloudkms.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "dns.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iap.googleapis.com",
    "servicenetworking.googleapis.com",
    "binaryauthorization.googleapis.com",
    "containersecurity.googleapis.com",
    "mesh.googleapis.com",
    "accesscontextmanager.googleapis.com",
    "orgpolicy.googleapis.com",
    "certificatemanager.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}
