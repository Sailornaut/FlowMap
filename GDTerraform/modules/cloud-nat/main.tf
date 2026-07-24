# ------------------------------------------------------------------------------
# Cloud NAT — Egress for private GKE nodes
#
# GKE private nodes need NAT for pulling images and reaching external
# endpoints. IL5: all egress still stays within US regions.
# ------------------------------------------------------------------------------

resource "google_compute_router" "this" {
  name    = var.router_name
  project = var.project_id
  region  = var.region
  network = var.network_id
}

resource "google_compute_router_nat" "this" {
  name                               = var.nat_name
  project                            = var.project_id
  router                             = google_compute_router.this.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }

  min_ports_per_vm                    = var.min_ports_per_vm
  max_ports_per_vm                    = var.max_ports_per_vm
  enable_dynamic_port_allocation      = var.enable_dynamic_port_allocation
  enable_endpoint_independent_mapping = false
}
