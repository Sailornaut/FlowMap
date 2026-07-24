# GameDay IL5 GCP Infrastructure — Terraform

This repository contains the complete Terraform infrastructure for deploying the GameDay platform on Google Cloud Platform within a DoD Impact Level 5 (IL5) Assured Workloads environment. It is a ground-up translation of the existing AWS GovCloud infrastructure (`gameday-infra-aws`) to GCP-native services, preserving the same two-cluster architecture, security posture, and operational patterns.

## Architecture Overview

The GameDay platform runs across two private GKE clusters in a shared VPC, fronted by an HTTPS load balancer, with Keycloak (on Cloud SQL) handling authentication. An LLM inference stack (vLLM on GPU nodes + LiteLLM proxy) runs on a dedicated cluster to isolate GPU workloads from the app plane.

```
                        ┌─────────────────────────────────────────────────────────┐
                        │              Assured Workloads Folder (IL5)             │
                        │                                                         │
  Internet ──► HTTPS LB ──► Istio Ingress Gateway                                │
                (TLS 1.2+)      │                                                 │
                (Managed Cert)  ├── GameDay API          ┌──────────────────┐     │
                                ├── GameDay Tiles        │  LLM Cluster     │     │
                                ├── Keycloak (auth)      │  ┌────────────┐  │     │
                                ├── ArgoCD               │  │ vLLM (GPU) │  │     │
                                ├── Grafana              │  │ 4x L4 GPUs │  │     │
                                └── OAuth2 Proxy         │  └────────────┘  │     │
                                                         │  ┌────────────┐  │     │
                                                         │  │  LiteLLM   │  │     │
                                                         │  │   Proxy    │  │     │
                                                         │  └────────────┘  │     │
                                                         └──────────────────┘     │
                                      │                          │                │
                             ┌────────┴────────┐        ┌───────┴──────┐         │
                             │   Cloud SQL     │        │  GCS Models  │         │
                             │  (PostgreSQL)   │        │   Bucket     │         │
                             │   CMEK + HA     │        │   CMEK       │         │
                             └─────────────────┘        └──────────────┘         │
                        └─────────────────────────────────────────────────────────┘
```

All resources are deployed to US regions only, encrypted with customer-managed keys (CMEK), and placed inside a GCP Assured Workloads folder that enforces IL5 organizational policy constraints automatically.

## AWS → GCP Service Mapping

| AWS Service | GCP IL5 Equivalent | Module |
|---|---|---|
| VPC + 4 subnet tiers + IGW + NAT | VPC + custom subnets + Cloud NAT | `vpc`, `cloud-nat` |
| EKS (2 clusters) | GKE private clusters (app + LLM) | `gke-cluster` |
| EKS Managed Node Groups | GKE Node Pools | `gke-nodepool` |
| RDS PostgreSQL (Keycloak) | Cloud SQL for PostgreSQL | `cloud-sql` |
| ECR (container registry) | Artifact Registry | `artifact-registry` |
| AWS Secrets Manager | GCP Secret Manager | `secret-manager` |
| KMS (6 CMKs) | Cloud KMS key ring + 6 crypto keys | `cloud-kms` |
| S3 (models, deploy, logs) | GCS buckets | `gcs` |
| Route 53 + DNSSEC | Cloud DNS + DNSSEC | `cloud-dns` |
| ALB + ACM wildcard cert | HTTPS Load Balancer + managed SSL cert | `load-balancer` |
| IRSA (IAM Roles for Service Accounts) | Workload Identity | `workload-identity` |
| Security Groups (cluster, node, data, VPC endpoint, ALB) | VPC Firewall Rules | `firewall-rules` |
| VPC Flow Logs (to S3 with CMEK) | VPC Flow Logs (subnet-level, all-metadata) | built into `vpc` |
| CloudWatch Logs | Cloud Logging | native GKE integration |
| CloudWatch Metrics | Cloud Monitoring + Managed Prometheus | native GKE integration |
| EKS add-ons (VPC CNI, CoreDNS, EBS CSI) | GKE add-ons (Dataplane V2, PD CSI, DNS cache) | built into `gke-cluster` |
| g6.12xlarge (4x L4 GPU) | g2-standard-48 (4x NVIDIA L4) | `gke-nodepool` |
| N/A (manual) | Assured Workloads IL5 folder | `assured-workloads` |

## Directory Structure

```
GDTerraform/
├── modules/                          # Reusable Terraform modules
│   ├── artifact-registry/            # Docker container registry (CMEK)
│   ├── assured-workloads/            # IL5 compliance boundary
│   ├── cloud-dns/                    # Managed DNS zones + DNSSEC
│   ├── cloud-kms/                    # CMEK key ring and crypto keys
│   ├── cloud-nat/                    # NAT gateway for private nodes
│   ├── cloud-sql/                    # PostgreSQL with private IP + CMEK
│   ├── firewall-rules/               # Network firewall (replaces SGs)
│   ├── gcs/                          # Cloud Storage buckets (CMEK)
│   ├── gke-cluster/                  # GKE private cluster
│   ├── gke-nodepool/                 # GKE node pools (incl. GPU)
│   ├── load-balancer/                # HTTPS LB + SSL policy
│   ├── secret-manager/               # Secret storage (CMEK)
│   ├── vpc/                          # VPC network + subnets
│   └── workload-identity/            # K8s SA ↔ GCP SA binding (IRSA equiv)
│
└── environments/
    └── il5-gcp/
        ├── base/                     # Phase 1: foundational resources
        │   ├── apis.tf               # GCP API enablement (20 APIs)
        │   ├── backend.tf            # GCS state backend
        │   ├── locals.tf             # Service agent emails, labels
        │   ├── main.tf               # All base resource composition
        │   ├── outputs.tf            # 18 outputs for downstream phases
        │   ├── providers.tf          # google + google-beta + random
        │   ├── variables.tf          # All base-layer variables
        │   └── terraform.tfvars.example
        ├── cluster/                  # Phase 2: app GKE cluster
        │   ├── backend.tf
        │   ├── data.tf               # Remote state from base
        │   ├── main.tf               # GKE cluster + node pool + WI + LB + DNS
        │   ├── outputs.tf
        │   ├── providers.tf
        │   ├── variables.tf
        │   └── terraform.tfvars.example
        └── cluster-llm/              # Phase 3: LLM GKE cluster
            ├── backend.tf
            ├── data.tf               # Remote state from base
            ├── main.tf               # GKE cluster + system + GPU pools + WI
            ├── outputs.tf
            ├── providers.tf
            ├── variables.tf
            └── terraform.tfvars.example
```

## Apply Order

The three phases must be applied sequentially. Each phase reads the prior phase's outputs via `terraform_remote_state`.

```
Phase 1: base          Phase 2: cluster        Phase 3: cluster-llm
─────────────────      ──────────────────      ────────────────────
Assured Workloads      GKE app cluster         GKE LLM cluster
Cloud KMS (6 keys)     Primary node pool       System node pool
VPC + subnets          WI: External Secrets    GPU node pool (4x L4)
Cloud NAT              WI: cert-manager        WI: vLLM server
Firewall rules         HTTPS Load Balancer     WI: vLLM server 31B
Cloud SQL (Keycloak)   DNS A records           WI: External Secrets
Artifact Registry      
GCS buckets (x3)       
Secret Manager (14)    
Cloud DNS + DNSSEC     
Node service account   
20 GCP APIs enabled    
```

### Applying

```bash
# 1. Create the GCS state bucket manually first
gsutil mb -l US -p <PROJECT_ID> gs://<IL5_STATE_BUCKET>/
gsutil versioning set on gs://<IL5_STATE_BUCKET>/

# 2. Replace placeholders
find . -name "*.tf" -exec sed -i 's/<IL5_STATE_BUCKET>/your-state-bucket/g' {} +

# 3. Copy and fill tfvars
cp environments/il5-gcp/base/terraform.tfvars.example environments/il5-gcp/base/terraform.tfvars
# (edit with your project_id, org_id, billing_account, domain, etc.)

# 4. Apply in order
cd environments/il5-gcp/base
terraform init && terraform apply

cd ../cluster
terraform init && terraform apply

cd ../cluster-llm
terraform init && terraform apply
```

## Module Details

### `assured-workloads`

Creates a GCP Assured Workloads environment scoped to IL5. This provisions a managed folder with automatic organizational policy constraints enforcing US-only data residency, CMEK requirements, and resource location restrictions. All project resources should live inside this folder.

**Resources created:** `google_assured_workloads_workload`

### `cloud-kms`

Creates a KMS key ring with multiple crypto keys, one per service category. IL5 mandates CMEK for all data at rest. The module also handles IAM grants so that GCP service agents (GKE, Cloud SQL, GCS, etc.) can use the keys for transparent encryption.

**Resources created:** `google_kms_key_ring`, `google_kms_crypto_key` (x6), `google_kms_crypto_key_iam_member` (x7)

The six keys and their consumers:

| Key | Encrypts | Service Agent Granted |
|---|---|---|
| `gke` | GKE etcd secrets | container-engine-robot |
| `compute` | GKE boot disks, PVs | container-engine-robot, compute-system |
| `sql` | Cloud SQL storage | gcp-sa-cloud-sql |
| `gcs` | GCS bucket objects | gs-project-accounts |
| `secrets` | Secret Manager values | gcp-sa-secretmanager |
| `ar` | Artifact Registry images | gcp-sa-artifactregistry |

### `vpc`

Custom-mode VPC with three subnet tiers plus an optional proxy-only subnet for internal load balancers. All subnets enable VPC Flow Logs with `INCLUDE_ALL_METADATA` at 50% sampling for IL5 audit compliance. Private Google Access is enabled on all subnets.

Private Service Access is configured for Cloud SQL private IP connectivity via VPC peering with Google's `servicenetworking.googleapis.com`.

**Resources created:** `google_compute_network`, `google_compute_subnetwork` (x3–4), `google_compute_global_address` (PSA), `google_service_networking_connection`

Subnet layout in the base environment:

| Subnet | CIDR (default) | Purpose |
|---|---|---|
| `gameday-il5-app-nodes` | 10.0.0.0/20 | App cluster GKE nodes |
| ↳ secondary `pods` | 10.4.0.0/14 | App cluster pod IPs |
| ↳ secondary `services` | 10.8.0.0/20 | App cluster service IPs |
| `gameday-il5-llm-nodes` | 10.3.0.0/20 | LLM cluster GKE nodes |
| ↳ secondary `llm-pods` | 10.12.0.0/14 | LLM cluster pod IPs |
| ↳ secondary `llm-services` | 10.16.0.0/20 | LLM cluster service IPs |
| `gameday-il5-data` | 10.1.0.0/24 | Cloud SQL / data services |
| `gameday-il5-proxy-only` | 10.2.0.0/24 | Internal LB proxies |

### `cloud-nat`

Cloud Router + Cloud NAT for private GKE node egress. Uses auto-allocated IPs with dynamic port allocation. NAT logging is enabled (errors only) for troubleshooting.

**Resources created:** `google_compute_router`, `google_compute_router_nat`

### `firewall-rules`

Five firewall rules replacing the five AWS security groups (cluster, node, VPC endpoint, data, ALB). All rules have audit logging enabled (`INCLUDE_ALL_METADATA`).

| Rule | Priority | Purpose |
|---|---|---|
| `allow-internal` | 1000 | All TCP/UDP/ICMP between VPC CIDRs |
| `allow-master` | 900 | GKE master → nodes (kubelet, webhooks, Istio) |
| `allow-health-checks` | 900 | GCP health check ranges → nodes |
| `allow-iap-ssh` | 1000 | IAP SSH tunnel access (35.235.240.0/20) |
| `deny-all-ingress` | 65534 | Default deny (defense in depth) |

### `cloud-sql`

Cloud SQL for PostgreSQL instance with private IP only (no public endpoint). Configured with CMEK, automated backups with point-in-time recovery, Query Insights, and comprehensive database flags for audit logging (`log_checkpoints`, `log_connections`, `log_disconnections`, `log_lock_waits`, `log_temp_files`).

**Resources created:** `google_sql_database_instance`, `google_sql_database`, `google_sql_user`, `random_password`

### `artifact-registry`

Two Docker repositories (platform + app) with CMEK encryption and immutable tags. Cleanup policies auto-delete untagged images after 14 days. Replaces the per-image ECR repositories from AWS with a more consolidated two-repo layout.

**Resources created:** `google_artifact_registry_repository` (x2)

### `gcs`

CMEK-encrypted GCS buckets with uniform bucket-level access (no ACLs) and enforced public access prevention. Three buckets are created in the base layer:

| Bucket | Purpose | Versioning |
|---|---|---|
| `gameday-il5-models-*` | LLM model weight files (synced from handoff) | Off |
| `gameday-il5-deploy-*` | Deployment artifacts for bastion transfer | Off |
| `gameday-il5-access-logs-*` | GCS access logging (90-day lifecycle) | Off |

### `secret-manager`

Fourteen secrets stored in Secret Manager with CMEK encryption and single-region replication (US). Mirrors the exact secret set from `gameday-infra-aws`:

- `gameday-pg-password` — PostgreSQL password for app database
- `gameday-keycloak-admin-password` — Keycloak admin
- `gameday-keycloak-db-password` — Keycloak database password (from Cloud SQL)
- `gameday-keycloak-db-username` — Keycloak database username
- `gameday-oauth2-proxy-cookie-secret` — OAuth2 Proxy cookie (gameday)
- `gameday-oauth2-proxy-argocd-cookie-secret` — OAuth2 Proxy cookie (ArgoCD)
- `gameday-oauth2-proxy-grafana-cookie-secret` — OAuth2 Proxy cookie (Grafana)
- `gameday-oauth2-proxy-gameday-cookie-secret` — OAuth2 Proxy cookie (app)
- `gameday-grafana-admin-password` — Grafana admin
- `gameday-argocd-oauth2-client-secret` — ArgoCD OIDC client secret (placeholder)
- `gameday-gameday-oauth2-client-secret` — GameDay OIDC client secret (placeholder)
- `gameday-grafana-oauth2-client-secret` — Grafana OIDC client secret (placeholder)
- `gameday-llm-api-key` — LLM API key (placeholder)
- `gameday-mssql-app-password` — SABER MSSQL password (placeholder)

### `cloud-dns`

Public managed DNS zone with DNSSEC enabled (RSA SHA-256). The cluster phase adds wildcard A records pointing at the load balancer IP. Replaces AWS Route 53.

**Resources created:** `google_dns_managed_zone`, `google_dns_record_set` (per record)

### `gke-cluster`

Private GKE cluster with IL5-hardened configuration:

- **Private cluster**: private nodes, optionally private endpoint (no public API)
- **Dataplane V2** (Cilium): replaces Calico for network policy enforcement
- **CMEK**: etcd secrets encrypted with dedicated KMS key
- **Workload Identity**: enabled at cluster level (`project.svc.id.goog`)
- **Binary Authorization**: enforces signed-image policy
- **Logging**: system + workload + API server + scheduler + controller manager
- **Monitoring**: system + API server + all workload types + Managed Prometheus
- **Add-ons**: HTTP LB, HPA, PD CSI driver, DNS cache
- **Shielded nodes**: Secure Boot + Integrity Monitoring
- **Maintenance window**: daily at 03:00 UTC

**Resources created:** `google_container_cluster`

### `gke-nodepool`

Node pools with Shielded VM, CMEK boot disk encryption, and Workload Identity metadata server. Supports GPU accelerator attachment for the LLM cluster. Auto-repair and auto-upgrade are always enabled.

Three node pools are created across the two clusters:

| Pool | Cluster | Machine Type | GPUs | Purpose |
|---|---|---|---|---|
| `primary` | app | e2-standard-4 | — | Platform + app workloads |
| `system` | LLM | e2-standard-4 | — | LiteLLM, CoreDNS, device plugin |
| `gpu` | LLM | g2-standard-48 | 4x NVIDIA L4 | vLLM inference |

The GPU pool uses a `nvidia.com/gpu=true:NoSchedule` taint to prevent non-GPU workloads from landing on expensive GPU nodes, matching the AWS EKS configuration.

### `load-balancer`

External HTTPS load balancer with Google-managed wildcard SSL certificate, TLS 1.2+ RESTRICTED SSL policy, and HTTP→HTTPS redirect. Routes to Istio ingress gateway via NEG backends.

**Resources created:** `google_compute_managed_ssl_certificate`, `google_compute_health_check`, `google_compute_backend_service`, `google_compute_url_map` (x2), `google_compute_target_https_proxy`, `google_compute_target_http_proxy`, `google_compute_ssl_policy`, `google_compute_forwarding_rule` (x2)

### `workload-identity`

Creates a GCP service account, binds it to a Kubernetes service account via Workload Identity, and grants IAM roles. This is the GCP equivalent of AWS IRSA.

Five Workload Identity bindings are created:

| GCP SA | K8s SA | Namespace | Roles | Purpose |
|---|---|---|---|---|
| `gameday-il5-ext-secrets` | `external-secrets-sa` | `external-secrets` | secretmanager.secretAccessor | Sync secrets to K8s |
| `gameday-il5-cert-mgr` | `cert-manager` | `cert-manager` | dns.admin | ACME DNS challenges |
| `gameday-il5-vllm-server` | `vllm-server` | `dla-gameday` | storage.objectViewer + KMS decrypt | Load model weights |
| `gameday-il5-vllm-31b` | `vllm-server-31b` | `dla-gameday` | storage.objectViewer + KMS decrypt | Load 31B model weights |
| `gameday-il5-llm-ext-sec` | `external-secrets-sa` | `external-secrets` | secretmanager.secretAccessor | Sync secrets (LLM cluster) |

## IL5 Compliance Controls

Every resource in this Terraform enforces IL5 requirements:

**Data Residency**: All resources deploy to `us-central1`. GCS buckets use `US` multi-region. Assured Workloads folder enforces US-only location constraints at the org policy level.

**Encryption at Rest (CMEK)**: Six dedicated KMS keys encrypt GKE etcd, compute disks, Cloud SQL, GCS, Secret Manager, and Artifact Registry. No resource uses default Google-managed encryption.

**Encryption in Transit**: TLS 1.2+ enforced via RESTRICTED SSL policy on the load balancer. Cloud SQL connections are private-IP only (no public endpoint).

**Network Isolation**: Both GKE clusters are fully private (private nodes, optionally private endpoint). Cloud SQL has no public IP. Default-deny firewall rule at priority 65534.

**Audit Logging**: VPC Flow Logs on all subnets, firewall rule logging on all rules, Cloud NAT error logging, Cloud SQL audit flags, GKE control plane logging (API server, audit, authenticator, controller manager, scheduler), and GCS access logging.

**Identity**: Workload Identity replaces node-level credentials. GKE nodes run with a least-privilege service account (6 roles). Binary Authorization enforces image signing policy.

**Node Security**: Shielded GKE nodes with Secure Boot and Integrity Monitoring. IMDSv2 equivalent (GKE metadata server). Container-Optimized OS (COS_CONTAINERD).

## GCP APIs Enabled

The base phase enables 20 GCP APIs required for IL5 operations:

`assuredworkloads`, `compute`, `container`, `sqladmin`, `cloudkms`, `secretmanager`, `artifactregistry`, `dns`, `logging`, `monitoring`, `cloudresourcemanager`, `iam`, `iap`, `servicenetworking`, `binaryauthorization`, `containersecurity`, `mesh`, `accesscontextmanager`, `orgpolicy`, `certificatemanager`

## Total Resource Count

| Phase | Modules | Direct Resources | Key Outputs |
|---|---|---|---|
| base | 11 | 10 | 18 |
| cluster | 5 | 1 | 7 |
| cluster-llm | 6 | 2 | 6 |
| **Total** | **22 module calls** | **13 direct resources** | **31 outputs** |

## Post-Terraform Steps

After all three phases are applied, the following manual or ArgoCD-driven steps complete the platform:

1. **Bootstrap ArgoCD** on the app cluster (Helm install, configure repo secret)
2. **Deploy the platform app-of-apps** (Istio, Keycloak, External Secrets, Prometheus, Grafana)
3. **Configure Keycloak** realm, clients, and groups (via script or Terraform keycloak provider)
4. **Wire NEG backends** into the load balancer (Istio ingress gateway creates NEGs automatically when annotated)
5. **Sync model weights** to the GCS models bucket (`gsutil rsync`)
6. **Deploy app-layer ArgoCD apps** (GameDay API, tiles, seed, preview, pgbouncer)
7. **Update placeholder secrets** in Secret Manager with real OAuth2 client secrets from Keycloak
