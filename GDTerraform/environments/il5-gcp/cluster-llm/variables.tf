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
# GKE LLM Cluster
# ------------------------------------------------------------------------------

variable "cluster_name" {
  description = "GKE LLM cluster name"
  type        = string
  default     = "gameday-llm-cluster"
}

variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.31"
}

variable "enable_private_endpoint" {
  description = "Fully private endpoint"
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
# System Node Pool (LiteLLM, NVIDIA device plugin, CoreDNS)
# ------------------------------------------------------------------------------

variable "system_machine_type" {
  description = "Machine type for system node pool"
  type        = string
  default     = "e2-standard-4"
}

variable "system_disk_size" {
  description = "Disk size in GB"
  type        = number
  default     = 100
}

variable "system_min_nodes" {
  description = "Minimum system nodes per zone"
  type        = number
  default     = 1
}

variable "system_max_nodes" {
  description = "Maximum system nodes per zone"
  type        = number
  default     = 2
}

# ------------------------------------------------------------------------------
# GPU Node Pool (vLLM inference)
# ------------------------------------------------------------------------------

variable "gpu_enabled" {
  description = "Enable GPU node pool"
  type        = bool
  default     = true
}

variable "gpu_machine_type" {
  description = "Machine type for GPU nodes (must support attached GPUs)"
  type        = string
  default     = "g2-standard-48"
}

variable "gpu_type" {
  description = "GPU accelerator type"
  type        = string
  default     = "nvidia-l4"
}

variable "gpu_count" {
  description = "GPUs per node"
  type        = number
  default     = 4
}

variable "gpu_disk_size" {
  description = "Disk size in GB for GPU nodes"
  type        = number
  default     = 500
}

variable "gpu_min_nodes" {
  description = "Minimum GPU nodes per zone"
  type        = number
  default     = 0
}

variable "gpu_max_nodes" {
  description = "Maximum GPU nodes per zone"
  type        = number
  default     = 2
}

variable "gpu_initial_nodes" {
  description = "Initial GPU nodes per zone"
  type        = number
  default     = 1
}
