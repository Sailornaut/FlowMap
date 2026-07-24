# ------------------------------------------------------------------------------
# Core
# ------------------------------------------------------------------------------

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "il5"
}

# ------------------------------------------------------------------------------
# GKE Cluster
# ------------------------------------------------------------------------------

variable "cluster_name" {
  description = "GKE app cluster name"
  type        = string
  default     = "gameday-app-cluster"
}

variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.31"
}

variable "enable_private_endpoint" {
  description = "Fully private endpoint (no public API)"
  type        = bool
  default     = true
}

variable "master_authorized_networks" {
  description = "CIDRs authorized to access the GKE API"
  type = list(object({
    cidr         = string
    display_name = string
  }))
  default = []
}

# ------------------------------------------------------------------------------
# Primary Node Pool
# ------------------------------------------------------------------------------

variable "primary_machine_type" {
  description = "Machine type for primary node pool"
  type        = string
  default     = "e2-standard-4"
}

variable "primary_disk_size" {
  description = "Disk size in GB for primary nodes"
  type        = number
  default     = 100
}

variable "primary_min_nodes" {
  description = "Minimum nodes per zone"
  type        = number
  default     = 1
}

variable "primary_max_nodes" {
  description = "Maximum nodes per zone"
  type        = number
  default     = 3
}

# ------------------------------------------------------------------------------
# Domain
# ------------------------------------------------------------------------------

variable "domain" {
  description = "Application domain"
  type        = string
  default     = "gameday.dla-lz.us"
}
