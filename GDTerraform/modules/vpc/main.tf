# ------------------------------------------------------------------------------
# VPC Network — GCP IL5
#
# Creates a custom-mode VPC with private subnets for GKE nodes, data
# subnets for Cloud SQL, and optional proxy-only subnets for internal
# load balancers. VPC Flow Logs are enabled on all subnets for IL5 audit.
# ------------------------------------------------------------------------------

resource "google_compute_network" "this" {
  name                    = var.name
  project                 = var.project_id
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

# ------------------------------------------------------------------------------
# Subnets
# ------------------------------------------------------------------------------

resource "google_compute_subnetwork" "private" {
  for_each = var.private_subnets

  name                     = each.key
  project                  = var.project_id
  region                   = var.region
  network                  = google_compute_network.this.id
  ip_cidr_range            = each.value.cidr
  private_ip_google_access = true

  # GKE secondary ranges for pods and services
  dynamic "secondary_ip_range" {
    for_each = each.value.secondary_ranges
    content {
      range_name    = secondary_ip_range.value.name
      ip_cidr_range = secondary_ip_range.value.cidr
    }
  }

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_subnetwork" "data" {
  for_each = var.data_subnets

  name                     = each.key
  project                  = var.project_id
  region                   = var.region
  network                  = google_compute_network.this.id
  ip_cidr_range            = each.value.cidr
  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Proxy-only subnet for internal HTTPS load balancers (Envoy-based)
resource "google_compute_subnetwork" "proxy_only" {
  count = var.proxy_only_subnet_cidr != null ? 1 : 0

  name          = "${var.name}-proxy-only"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.this.id
  ip_cidr_range = var.proxy_only_subnet_cidr
  purpose       = "REGIONAL_MANAGED_PROXY"
  role          = "ACTIVE"
}

# ------------------------------------------------------------------------------
# Private Service Access (for Cloud SQL private IP)
# ------------------------------------------------------------------------------

resource "google_compute_global_address" "private_service_access" {
  count = var.enable_private_service_access ? 1 : 0

  name          = "${var.name}-psa"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = var.psa_prefix_length
  network       = google_compute_network.this.id
}

resource "google_service_networking_connection" "private_service_access" {
  count = var.enable_private_service_access ? 1 : 0

  network                 = google_compute_network.this.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_access[0].name]
}
