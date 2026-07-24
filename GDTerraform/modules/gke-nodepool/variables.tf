variable "node_pool_name" {
  description = "Node pool name"
  type        = string
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Cluster location (region or zone)"
  type        = string
}

variable "cluster_name" {
  description = "GKE cluster name"
  type        = string
}

variable "machine_type" {
  description = "GCE machine type"
  type        = string
  default     = "e2-standard-4"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 100
}

variable "disk_type" {
  description = "Boot disk type"
  type        = string
  default     = "pd-ssd"
}

variable "image_type" {
  description = "Node image type"
  type        = string
  default     = "COS_CONTAINERD"
}

variable "boot_disk_kms_key_id" {
  description = "Cloud KMS key ID for boot disk encryption"
  type        = string
}

variable "node_service_account" {
  description = "GCP service account email for nodes"
  type        = string
}

variable "initial_node_count" {
  description = "Initial node count per zone"
  type        = number
  default     = 1
}

variable "min_node_count" {
  description = "Minimum nodes per zone"
  type        = number
  default     = 1
}

variable "max_node_count" {
  description = "Maximum nodes per zone"
  type        = number
  default     = 3
}

variable "max_surge" {
  description = "Max surge during upgrades"
  type        = number
  default     = 1
}

variable "max_unavailable" {
  description = "Max unavailable during upgrades"
  type        = number
  default     = 0
}

variable "node_labels" {
  description = "Labels for nodes"
  type        = map(string)
  default     = {}
}

variable "node_tags" {
  description = "Network tags for nodes"
  type        = list(string)
  default     = ["gke-node"]
}

variable "taints" {
  description = "Taints for nodes"
  type = list(object({
    key    = string
    value  = string
    effect = string
  }))
  default = []
}

# --- GPU ---

variable "gpu_type" {
  description = "GPU accelerator type (null to disable)"
  type        = string
  default     = null
}

variable "gpu_count" {
  description = "Number of GPUs per node"
  type        = number
  default     = 0
}

variable "gpu_driver_version" {
  description = "GPU driver version (DEFAULT, LATEST, INSTALLATION_DISABLED)"
  type        = string
  default     = "DEFAULT"
}
