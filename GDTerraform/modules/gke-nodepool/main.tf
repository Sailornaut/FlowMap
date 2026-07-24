# ------------------------------------------------------------------------------
# GKE Node Pool — IL5 Hardened
#
# Shielded nodes, CMEK boot disk encryption, Workload Identity,
# Secure Boot, and integrity monitoring.
# Equivalent to AWS EKS Managed Node Groups.
# ------------------------------------------------------------------------------

resource "google_container_node_pool" "this" {
  name     = var.node_pool_name
  project  = var.project_id
  location = var.location
  cluster  = var.cluster_name

  initial_node_count = var.initial_node_count

  autoscaling {
    min_node_count = var.min_node_count
    max_node_count = var.max_node_count
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  upgrade_settings {
    max_surge       = var.max_surge
    max_unavailable = var.max_unavailable
    strategy        = "SURGE"
  }

  node_config {
    machine_type = var.machine_type
    disk_size_gb = var.disk_size_gb
    disk_type    = var.disk_type
    image_type   = var.image_type

    # CMEK boot disk encryption
    boot_disk_kms_key = var.boot_disk_kms_key_id

    # IL5 security hardening
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    # Workload Identity — pods use GCP SA instead of node SA
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Minimal node service account scope
    service_account = var.node_service_account
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    labels = var.node_labels
    tags   = var.node_tags

    dynamic "taint" {
      for_each = var.taints
      content {
        key    = taint.value.key
        value  = taint.value.value
        effect = taint.value.effect
      }
    }

    # GPU configuration
    dynamic "guest_accelerator" {
      for_each = var.gpu_type != null ? [1] : []
      content {
        type  = var.gpu_type
        count = var.gpu_count

        gpu_driver_installation_config {
          gpu_driver_version = var.gpu_driver_version
        }
      }
    }

    metadata = {
      disable-legacy-endpoints = "true"
    }
  }

  lifecycle {
    ignore_changes = [initial_node_count]
  }
}
