# ------------------------------------------------------------------------------
# Firewall Rules — GCP IL5
#
# Equivalent to AWS security groups. GCP uses network-level firewall rules
# with tags/service accounts for targeting.
# ------------------------------------------------------------------------------

# Allow internal communication between all GKE nodes
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.name}-allow-internal"
  project = var.project_id
  network = var.network_id

  allow {
    protocol = "tcp"
  }
  allow {
    protocol = "udp"
  }
  allow {
    protocol = "icmp"
  }

  source_ranges = var.internal_cidrs
  priority      = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Allow GKE master to reach nodes on kubelet (10250) and webhook (8443, 15017)
resource "google_compute_firewall" "allow_master_to_nodes" {
  name    = "${var.name}-allow-master"
  project = var.project_id
  network = var.network_id

  allow {
    protocol = "tcp"
    ports    = ["10250", "8443", "15017", "15021", "443"]
  }

  source_ranges = var.master_ipv4_cidr_blocks
  target_tags   = var.node_tags
  priority      = 900

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Allow health checks from GCP load balancer ranges
resource "google_compute_firewall" "allow_health_checks" {
  name    = "${var.name}-allow-health-checks"
  project = var.project_id
  network = var.network_id

  allow {
    protocol = "tcp"
    ports    = var.health_check_ports
  }

  # GCP health check source ranges
  source_ranges = ["35.191.0.0/16", "130.211.0.0/22"]
  target_tags   = var.node_tags
  priority      = 900

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Allow IAP for SSH (bastion/troubleshooting)
resource "google_compute_firewall" "allow_iap_ssh" {
  count = var.enable_iap_ssh ? 1 : 0

  name    = "${var.name}-allow-iap-ssh"
  project = var.project_id
  network = var.network_id

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"] # IAP range
  target_tags   = var.node_tags
  priority      = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Deny all ingress (default deny — defense in depth)
resource "google_compute_firewall" "deny_all_ingress" {
  name    = "${var.name}-deny-all-ingress"
  project = var.project_id
  network = var.network_id

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
  priority      = 65534

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}
