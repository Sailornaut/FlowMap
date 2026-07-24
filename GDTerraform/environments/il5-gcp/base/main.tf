# ==============================================================================
# GameDay IL5 GCP — Base Infrastructure
#
# This phase creates foundational resources that the cluster phases depend on:
#   - Assured Workloads folder (IL5 controls)
#   - VPC network with subnets for app cluster, LLM cluster, and data
#   - Cloud NAT for private node egress
#   - Firewall rules
#   - Cloud KMS keys (CMEK for all services)
#   - Cloud SQL (Keycloak database)
#   - Artifact Registry (container images)
#   - GCS buckets (models, deploy artifacts, flow logs)
#   - Secret Manager (application secrets)
#   - Cloud DNS (managed zone)
#
# Apply order: base → cluster → cluster-llm
# ==============================================================================

# ------------------------------------------------------------------------------
# Assured Workloads (IL5 enforcement boundary)
# ------------------------------------------------------------------------------

module "assured_workloads" {
  source = "../../../modules/assured-workloads"

  display_name       = "${local.name_prefix}-il5"
  organization_id    = var.organization_id
  location           = var.region
  billing_account_id = var.billing_account_id
  parent             = var.assured_workloads_parent
  labels             = local.common_labels
}

# ------------------------------------------------------------------------------
# Cloud KMS (CMEK keys for all services)
# ------------------------------------------------------------------------------

module "kms" {
  source = "../../../modules/cloud-kms"

  project_id    = var.project_id
  key_ring_name = "${local.name_prefix}-keyring"
  location      = var.region

  keys = {
    gke = {
      description = "GKE etcd envelope encryption"
    }
    compute = {
      description = "Compute/disk encryption (GKE boot disks)"
    }
    sql = {
      description = "Cloud SQL storage encryption"
    }
    gcs = {
      description = "GCS bucket encryption"
    }
    secrets = {
      description = "Secret Manager encryption"
    }
    ar = {
      description = "Artifact Registry image encryption"
    }
  }

  # Grant service agents access to use CMEK keys
  key_iam_bindings = {
    gke_etcd = {
      key_name = "gke"
      member   = "serviceAccount:${local.gke_service_agent}"
    }
    gke_disks = {
      key_name = "compute"
      member   = "serviceAccount:${local.gke_service_agent}"
    }
    compute_disks = {
      key_name = "compute"
      member   = "serviceAccount:${local.compute_service_agent}"
    }
    sql = {
      key_name = "sql"
      member   = "serviceAccount:${local.sql_service_agent}"
    }
    gcs = {
      key_name = "gcs"
      member   = "serviceAccount:${local.gcs_service_agent}"
    }
    secrets = {
      key_name = "secrets"
      member   = "serviceAccount:${local.sm_service_agent}"
    }
    ar = {
      key_name = "ar"
      member   = "serviceAccount:${local.ar_service_agent}"
    }
  }

  labels = local.common_labels

  depends_on = [google_project_service.apis]
}

# ------------------------------------------------------------------------------
# VPC Network
# ------------------------------------------------------------------------------

module "vpc" {
  source = "../../../modules/vpc"

  name       = local.name_prefix
  project_id = var.project_id
  region     = var.region

  private_subnets = {
    "${local.name_prefix}-app-nodes" = {
      cidr = var.vpc_cidr
      secondary_ranges = [
        { name = "pods", cidr = var.pods_cidr },
        { name = "services", cidr = var.services_cidr },
      ]
    }
    "${local.name_prefix}-llm-nodes" = {
      cidr = var.llm_subnet_cidr
      secondary_ranges = [
        { name = "llm-pods", cidr = var.llm_pods_cidr },
        { name = "llm-services", cidr = var.llm_services_cidr },
      ]
    }
  }

  data_subnets = {
    "${local.name_prefix}-data" = {
      cidr = var.data_subnet_cidr
    }
  }

  proxy_only_subnet_cidr    = var.proxy_only_cidr
  enable_private_service_access = true

  depends_on = [google_project_service.apis]
}

# ------------------------------------------------------------------------------
# Cloud NAT (egress for private GKE nodes)
# ------------------------------------------------------------------------------

module "cloud_nat" {
  source = "../../../modules/cloud-nat"

  project_id  = var.project_id
  region      = var.region
  network_id  = module.vpc.network_id
  router_name = "${local.name_prefix}-router"
  nat_name    = "${local.name_prefix}-nat"
}

# ------------------------------------------------------------------------------
# Firewall Rules
# ------------------------------------------------------------------------------

module "firewall_rules" {
  source = "../../../modules/firewall-rules"

  name       = local.name_prefix
  project_id = var.project_id
  network_id = module.vpc.network_id

  internal_cidrs = [
    var.vpc_cidr,
    var.pods_cidr,
    var.services_cidr,
    var.llm_subnet_cidr,
    var.llm_pods_cidr,
    var.llm_services_cidr,
    var.data_subnet_cidr,
  ]

  master_ipv4_cidr_blocks = [
    "172.16.0.0/28",  # App cluster master
    "172.16.0.16/28", # LLM cluster master
  ]

  node_tags    = ["gke-node"]
  enable_iap_ssh = true
}

# ------------------------------------------------------------------------------
# Cloud SQL — Keycloak Database
# ------------------------------------------------------------------------------

module "keycloak_database" {
  source = "../../../modules/cloud-sql"

  instance_name     = "${local.name_prefix}-keycloak"
  project_id        = var.project_id
  region            = var.region
  database_name     = "keycloak"
  master_username   = "keycloak"
  tier              = var.keycloak_db_tier
  availability_type = var.keycloak_db_ha
  disk_size_gb      = var.keycloak_db_disk_size
  kms_key_id        = module.kms.key_ids["sql"]
  network_id        = module.vpc.network_self_link

  deletion_protection = true
  enable_pitr         = true

  labels = local.common_labels

  private_service_access_dependency = module.vpc
}

# ------------------------------------------------------------------------------
# Artifact Registry (container images — replaces ECR)
# ------------------------------------------------------------------------------

module "artifact_registry" {
  source = "../../../modules/artifact-registry"

  project_id = var.project_id
  location   = var.region
  kms_key_id = module.kms.key_ids["ar"]

  repositories = {
    "gameday-platform" = {
      description    = "Platform images (ArgoCD, Istio, Keycloak, etc.)"
      immutable_tags = true
      cleanup_policies = [
        {
          id     = "delete-untagged"
          action = "DELETE"
          condition = {
            tag_state  = "UNTAGGED"
            older_than = "1209600s" # 14 days
          }
        },
      ]
    }
    "gameday-app" = {
      description    = "Application images (API, dashboard, seed, tiles)"
      immutable_tags = true
      cleanup_policies = [
        {
          id     = "delete-untagged"
          action = "DELETE"
          condition = {
            tag_state  = "UNTAGGED"
            older_than = "1209600s"
          }
        },
      ]
    }
  }

  labels = local.common_labels

  depends_on = [google_project_service.apis]
}

# ------------------------------------------------------------------------------
# GCS Buckets
# ------------------------------------------------------------------------------

# Model weights bucket (equivalent to S3 models bucket)
module "models_bucket" {
  source = "../../../modules/gcs"

  bucket_name        = "${local.name_prefix}-models-${var.project_id}"
  project_id         = var.project_id
  location           = "US"
  kms_key_id         = module.kms.key_ids["gcs"]
  versioning_enabled = false
  labels             = local.common_labels
}

# Deploy artifacts bucket
module "deploy_bucket" {
  source = "../../../modules/gcs"

  bucket_name        = "${local.name_prefix}-deploy-${var.project_id}"
  project_id         = var.project_id
  location           = "US"
  kms_key_id         = module.kms.key_ids["gcs"]
  versioning_enabled = false
  labels             = local.common_labels
}

# Access logs bucket (for GCS access logging)
module "logs_bucket" {
  source = "../../../modules/gcs"

  bucket_name        = "${local.name_prefix}-access-logs-${var.project_id}"
  project_id         = var.project_id
  location           = "US"
  kms_key_id         = module.kms.key_ids["gcs"]
  versioning_enabled = false

  lifecycle_rules = [
    { age_days = 90, action = "Delete" },
  ]

  labels = local.common_labels
}

# ------------------------------------------------------------------------------
# Secret Manager (application secrets)
# ------------------------------------------------------------------------------

resource "random_password" "pg_password" {
  length  = 32
  special = false
}

resource "random_password" "keycloak_admin" {
  length  = 32
  special = false
}

resource "random_password" "oauth2_cookie" {
  length  = 32
  special = false
}

resource "random_password" "oauth2_argocd_cookie" {
  length  = 32
  special = false
}

resource "random_password" "oauth2_grafana_cookie" {
  length  = 32
  special = false
}

resource "random_password" "grafana_admin" {
  length  = 32
  special = false
}

resource "random_password" "oauth2_gameday_cookie" {
  length  = 32
  special = false
}

module "secrets" {
  source = "../../../modules/secret-manager"

  project_id = var.project_id
  location   = var.region
  kms_key_id = module.kms.key_ids["secrets"]

  secrets = {
    "gameday-pg-password" = {
      value = random_password.pg_password.result
    }
    "gameday-keycloak-admin-password" = {
      value = random_password.keycloak_admin.result
    }
    "gameday-keycloak-db-password" = {
      value = module.keycloak_database.master_password
    }
    "gameday-keycloak-db-username" = {
      value = "keycloak"
    }
    "gameday-oauth2-proxy-cookie-secret" = {
      value = random_password.oauth2_cookie.result
    }
    "gameday-oauth2-proxy-argocd-cookie-secret" = {
      value = random_password.oauth2_argocd_cookie.result
    }
    "gameday-oauth2-proxy-grafana-cookie-secret" = {
      value = random_password.oauth2_grafana_cookie.result
    }
    "gameday-oauth2-proxy-gameday-cookie-secret" = {
      value = random_password.oauth2_gameday_cookie.result
    }
    "gameday-grafana-admin-password" = {
      value = random_password.grafana_admin.result
    }
    "gameday-argocd-oauth2-client-secret" = {
      value = "placeholder-set-after-keycloak-configured"
    }
    "gameday-gameday-oauth2-client-secret" = {
      value = "placeholder-set-after-keycloak-configured"
    }
    "gameday-grafana-oauth2-client-secret" = {
      value = "placeholder-set-after-keycloak-configured"
    }
    "gameday-llm-api-key" = {
      value = "placeholder-set-after-llm-configured"
    }
    "gameday-mssql-app-password" = {
      value = "placeholder-set-after-saber-db-provisioned"
    }
  }

  labels = local.common_labels

  depends_on = [google_project_service.apis]
}

# ------------------------------------------------------------------------------
# Cloud DNS
# ------------------------------------------------------------------------------

module "dns" {
  source = "../../../modules/cloud-dns"

  zone_name     = "${local.name_prefix}-zone"
  project_id    = var.project_id
  domain        = var.domain
  enable_dnssec = true
  labels        = local.common_labels

  depends_on = [google_project_service.apis]
}

# ------------------------------------------------------------------------------
# Node Service Account (least-privilege for GKE nodes)
# ------------------------------------------------------------------------------

resource "google_service_account" "gke_nodes" {
  account_id   = "${local.name_prefix}-gke-node"
  display_name = "GKE Node Service Account"
  project      = var.project_id
}

# Minimal roles for GKE nodes
resource "google_project_iam_member" "gke_node_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/stackdriver.resourceMetadata.writer",
    "roles/artifactregistry.reader",
    "roles/storage.objectViewer",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}
