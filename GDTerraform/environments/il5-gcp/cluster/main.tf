# ==============================================================================
# GameDay IL5 GCP — App Cluster
#
# Creates the primary GKE cluster for platform and app workloads:
#   - GKE private cluster with Dataplane V2
#   - Primary node pool (general workloads)
#   - Workload Identity bindings (External Secrets, cert-manager)
#   - Load balancer for Istio ingress gateway
#   - DNS records
#
# Apply order: base → cluster → cluster-llm
# ==============================================================================

# ------------------------------------------------------------------------------
# GKE Cluster
# ------------------------------------------------------------------------------

module "gke_cluster" {
  source = "../../../modules/gke-cluster"

  cluster_name       = var.cluster_name
  project_id         = var.project_id
  location           = var.region
  kubernetes_version = var.kubernetes_version

  network_id   = local.base.network_id
  subnetwork_id = local.base.app_subnet_self_link

  pods_range_name     = "pods"
  services_range_name = "services"

  master_ipv4_cidr_block  = "172.16.0.0/28"
  enable_private_endpoint = var.enable_private_endpoint
  master_authorized_networks = var.master_authorized_networks

  etcd_kms_key_id = local.base.kms_key_ids["gke"]

  enable_binary_authorization = true
  enable_managed_prometheus   = true

  labels             = local.common_labels
  deletion_protection = true
}

# ------------------------------------------------------------------------------
# Primary Node Pool — general workloads (Istio, ArgoCD, app, platform)
# ------------------------------------------------------------------------------

module "nodepool_primary" {
  source = "../../../modules/gke-nodepool"

  node_pool_name       = "primary"
  project_id           = var.project_id
  location             = var.region
  cluster_name         = module.gke_cluster.cluster_name
  machine_type         = var.primary_machine_type
  disk_size_gb         = var.primary_disk_size
  boot_disk_kms_key_id = local.base.kms_key_ids["compute"]
  node_service_account = local.base.node_service_account_email

  min_node_count = var.primary_min_nodes
  max_node_count = var.primary_max_nodes

  node_labels = {
    "workload-type" = "general"
  }

  node_tags = ["gke-node", "gke-app-node"]
}

# ------------------------------------------------------------------------------
# Workload Identity — External Secrets Operator
# (Equivalent to AWS IRSA for Secrets Manager access)
# ------------------------------------------------------------------------------

module "wi_external_secrets" {
  source = "../../../modules/workload-identity"

  service_account_id  = "${local.name_prefix}-ext-secrets"
  display_name        = "External Secrets Operator"
  description         = "Accesses Secret Manager for K8s secret sync"
  project_id          = var.project_id
  k8s_namespace       = "external-secrets"
  k8s_service_account = "external-secrets-sa"

  project_roles = [
    "roles/secretmanager.secretAccessor",
  ]
}

# ------------------------------------------------------------------------------
# Workload Identity — cert-manager (for Cloud DNS ACME challenges)
# ------------------------------------------------------------------------------

module "wi_cert_manager" {
  source = "../../../modules/workload-identity"

  service_account_id  = "${local.name_prefix}-cert-mgr"
  display_name        = "cert-manager"
  description         = "Manages DNS records for ACME certificate validation"
  project_id          = var.project_id
  k8s_namespace       = "cert-manager"
  k8s_service_account = "cert-manager"

  project_roles = [
    "roles/dns.admin",
  ]
}

# ------------------------------------------------------------------------------
# Load Balancer — routes to Istio ingress gateway
# ------------------------------------------------------------------------------

module "load_balancer" {
  source = "../../../modules/load-balancer"

  name       = "${local.name_prefix}-lb"
  project_id = var.project_id
  region     = var.region
  internal   = false

  use_managed_cert    = true
  certificate_domains = [var.domain, "*.${var.domain}"]

  health_check_port = 15021
  health_check_path = "/healthz/ready"

  # NEGs are created by GKE when the Istio ingress gateway Service uses
  # NEG annotations. These will be wired up after initial cluster deploy.
  backend_negs = []

  labels = local.common_labels
}

# ------------------------------------------------------------------------------
# DNS Records — point to load balancer
# ------------------------------------------------------------------------------

resource "google_dns_record_set" "app_records" {
  for_each = toset([
    "${var.domain}.",
    "*.${var.domain}.",
  ])

  name         = each.value
  project      = var.project_id
  managed_zone = local.base.dns_zone_name
  type         = "A"
  ttl          = 300
  rrdatas      = [module.load_balancer.forwarding_rule_ip]
}
