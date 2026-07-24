# ==============================================================================
# GameDay IL5 GCP — LLM Cluster
#
# Separate GKE cluster for GPU inference workloads (vLLM + LiteLLM).
# Mirrors the AWS two-cluster pattern: app cluster + LLM cluster in the
# same VPC, communicating over private networking.
#
#   - System node pool: LiteLLM proxy, NVIDIA device plugin, CoreDNS
#   - GPU node pool: vLLM inference on NVIDIA L4 GPUs (g2-standard-48)
#   - Workload Identity for GCS model weight access
#
# Apply order: base → cluster → cluster-llm
# ==============================================================================

# ------------------------------------------------------------------------------
# GKE LLM Cluster
# ------------------------------------------------------------------------------

module "gke_cluster" {
  source = "../../../modules/gke-cluster"

  cluster_name       = var.cluster_name
  project_id         = var.project_id
  location           = var.region
  kubernetes_version = var.kubernetes_version

  network_id   = local.base.network_id
  subnetwork_id = local.base.llm_subnet_self_link

  pods_range_name     = "llm-pods"
  services_range_name = "llm-services"

  master_ipv4_cidr_block  = "172.16.0.16/28"
  enable_private_endpoint = var.enable_private_endpoint
  master_authorized_networks = var.master_authorized_networks

  etcd_kms_key_id = local.base.kms_key_ids["gke"]

  enable_binary_authorization = true
  enable_managed_prometheus   = true
  enable_gcs_fuse             = true # For model weight loading from GCS

  labels             = local.common_labels
  deletion_protection = true
}

# ------------------------------------------------------------------------------
# System Node Pool — LiteLLM, NVIDIA device plugin, CoreDNS
# ------------------------------------------------------------------------------

module "nodepool_system" {
  source = "../../../modules/gke-nodepool"

  node_pool_name       = "system"
  project_id           = var.project_id
  location             = var.region
  cluster_name         = module.gke_cluster.cluster_name
  machine_type         = var.system_machine_type
  disk_size_gb         = var.system_disk_size
  boot_disk_kms_key_id = local.base.kms_key_ids["compute"]
  node_service_account = local.base.node_service_account_email

  min_node_count = var.system_min_nodes
  max_node_count = var.system_max_nodes

  node_labels = {
    "workload-type" = "system"
  }

  node_tags = ["gke-node", "gke-llm-system-node"]
}

# ------------------------------------------------------------------------------
# GPU Node Pool — vLLM Inference (NVIDIA L4)
#
# g2-standard-48: 4x NVIDIA L4 (24GB each), 48 vCPUs
# Matches the AWS g6.12xlarge configuration used in IL5.
# Scale initial_node_count to 0 to stop GPU costs when idle.
# ------------------------------------------------------------------------------

module "nodepool_gpu" {
  source = "../../../modules/gke-nodepool"
  count  = var.gpu_enabled ? 1 : 0

  node_pool_name       = "gpu"
  project_id           = var.project_id
  location             = var.region
  cluster_name         = module.gke_cluster.cluster_name
  machine_type         = var.gpu_machine_type
  disk_size_gb         = var.gpu_disk_size
  boot_disk_kms_key_id = local.base.kms_key_ids["compute"]
  node_service_account = local.base.node_service_account_email

  initial_node_count = var.gpu_initial_nodes
  min_node_count     = var.gpu_min_nodes
  max_node_count     = var.gpu_max_nodes

  gpu_type           = var.gpu_type
  gpu_count          = var.gpu_count
  gpu_driver_version = "DEFAULT"

  node_labels = {
    "workload-type" = "gpu"
    "workload"      = "llm"
  }

  taints = [
    {
      key    = "nvidia.com/gpu"
      value  = "true"
      effect = "NO_SCHEDULE"
    }
  ]

  node_tags = ["gke-node", "gke-gpu-node"]
}

# ------------------------------------------------------------------------------
# Workload Identity — vLLM model loading from GCS
# (Equivalent to AWS IRSA for S3 model weight access)
# ------------------------------------------------------------------------------

module "wi_vllm_server" {
  source = "../../../modules/workload-identity"

  service_account_id  = "${local.name_prefix}-vllm-server"
  display_name        = "vLLM Server"
  description         = "Reads model weights from GCS bucket"
  project_id          = var.project_id
  k8s_namespace       = "dla-gameday"
  k8s_service_account = "vllm-server"

  project_roles = [
    "roles/storage.objectViewer",
  ]
}

# Grant vLLM SA access to decrypt objects in the models bucket
resource "google_kms_crypto_key_iam_member" "vllm_gcs_decrypt" {
  crypto_key_id = local.base.kms_key_ids["gcs"]
  role          = "roles/cloudkms.cryptoKeyDecrypter"
  member        = "serviceAccount:${module.wi_vllm_server.service_account_email}"
}

# Workload Identity for the secondary vLLM model (31b variant)
module "wi_vllm_server_31b" {
  source = "../../../modules/workload-identity"

  service_account_id  = "${local.name_prefix}-vllm-31b"
  display_name        = "vLLM Server 31B"
  description         = "Reads model weights from GCS bucket (31B model)"
  project_id          = var.project_id
  k8s_namespace       = "dla-gameday"
  k8s_service_account = "vllm-server-31b"

  project_roles = [
    "roles/storage.objectViewer",
  ]
}

resource "google_kms_crypto_key_iam_member" "vllm_31b_gcs_decrypt" {
  crypto_key_id = local.base.kms_key_ids["gcs"]
  role          = "roles/cloudkms.cryptoKeyDecrypter"
  member        = "serviceAccount:${module.wi_vllm_server_31b.service_account_email}"
}

# ------------------------------------------------------------------------------
# Workload Identity — External Secrets for LLM cluster
# ------------------------------------------------------------------------------

module "wi_external_secrets_llm" {
  source = "../../../modules/workload-identity"

  service_account_id  = "${local.name_prefix}-llm-ext-sec"
  display_name        = "External Secrets (LLM cluster)"
  description         = "Accesses Secret Manager for K8s secret sync in LLM cluster"
  project_id          = var.project_id
  k8s_namespace       = "external-secrets"
  k8s_service_account = "external-secrets-sa"

  project_roles = [
    "roles/secretmanager.secretAccessor",
  ]
}
