# ------------------------------------------------------------------------------
# GKE Cluster — IL5 Hardened
#
# Private cluster with:
#   - CMEK encryption for etcd and boot disks
#   - Workload Identity (GCP equivalent of IRSA)
#   - Binary Authorization enforcement
#   - Shielded GKE nodes
#   - Private endpoint (no public API by default)
#   - Network policy enforcement (Dataplane V2 / Cilium)
#   - Cloud Logging + Monitoring integration
# ------------------------------------------------------------------------------

resource "google_container_cluster" "this" {
  name     = var.cluster_name
  project  = var.project_id
  location = var.location

  # Use separately managed node pools
  initial_node_count       = 1
  remove_default_node_pool = true

  # Kubernetes version
  min_master_version = var.kubernetes_version

  release_channel {
    channel = var.release_channel
  }

  # --- Networking ---
  network    = var.network_id
  subnetwork = var.subnetwork_id

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = var.enable_private_endpoint
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block

    master_global_access_config {
      enabled = var.enable_master_global_access
    }
  }

  dynamic "master_authorized_networks_config" {
    for_each = length(var.master_authorized_networks) > 0 ? [1] : []
    content {
      dynamic "cidr_blocks" {
        for_each = var.master_authorized_networks
        content {
          cidr_block   = cidr_blocks.value.cidr
          display_name = cidr_blocks.value.display_name
        }
      }
    }
  }

  # --- Security ---
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  database_encryption {
    state    = "ENCRYPTED"
    key_name = var.etcd_kms_key_id
  }

  binary_authorization {
    evaluation_mode = var.enable_binary_authorization ? "PROJECT_SINGLETON_POLICY_ENFORCE" : "DISABLED"
  }

  # Dataplane V2 (Cilium-based) — replaces Calico for network policy
  datapath_provider = "ADVANCED_DATAPATH"

  # --- Logging & Monitoring ---
  logging_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
      "WORKLOADS",
      "APISERVER",
      "SCHEDULER",
      "CONTROLLER_MANAGER",
    ]
  }

  monitoring_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
      "APISERVER",
      "SCHEDULER",
      "CONTROLLER_MANAGER",
      "STORAGE",
      "HPA",
      "POD",
      "DAEMONSET",
      "DEPLOYMENT",
      "STATEFULSET",
    ]

    managed_prometheus {
      enabled = var.enable_managed_prometheus
    }
  }

  # --- Add-ons ---
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
    gcs_fuse_csi_driver_config {
      enabled = var.enable_gcs_fuse
    }
    dns_cache_config {
      enabled = true
    }
  }

  # --- Maintenance ---
  maintenance_policy {
    daily_maintenance_window {
      start_time = var.maintenance_start_time
    }
  }

  # --- Node security defaults ---
  node_config {
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  resource_labels = var.labels

  deletion_protection = var.deletion_protection
}
