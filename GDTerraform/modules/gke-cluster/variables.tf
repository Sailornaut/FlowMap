variable "cluster_name" {
  description = "GKE cluster name"
  type        = string
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Cluster location (region for regional cluster, zone for zonal)"
  type        = string
}

variable "kubernetes_version" {
  description = "Minimum Kubernetes master version"
  type        = string
  default     = "1.31"
}

variable "release_channel" {
  description = "GKE release channel (REGULAR, RAPID, STABLE)"
  type        = string
  default     = "REGULAR"
}

variable "network_id" {
  description = "VPC network ID"
  type        = string
}

variable "subnetwork_id" {
  description = "Subnetwork ID for nodes"
  type        = string
}

variable "pods_range_name" {
  description = "Name of the secondary range for pods"
  type        = string
}

variable "services_range_name" {
  description = "Name of the secondary range for services"
  type        = string
}

variable "master_ipv4_cidr_block" {
  description = "CIDR for the GKE master (private cluster)"
  type        = string
  default     = "172.16.0.0/28"
}

variable "enable_private_endpoint" {
  description = "Disable public API endpoint (true for full private)"
  type        = bool
  default     = true
}

variable "enable_master_global_access" {
  description = "Enable global access to master endpoint"
  type        = bool
  default     = true
}

variable "master_authorized_networks" {
  description = "CIDRs authorized to access the master"
  type = list(object({
    cidr         = string
    display_name = string
  }))
  default = []
}

variable "etcd_kms_key_id" {
  description = "Cloud KMS key ID for etcd encryption"
  type        = string
}

variable "enable_binary_authorization" {
  description = "Enable Binary Authorization"
  type        = bool
  default     = true
}

variable "enable_managed_prometheus" {
  description = "Enable GKE Managed Prometheus"
  type        = bool
  default     = true
}

variable "enable_gcs_fuse" {
  description = "Enable GCS FUSE CSI driver"
  type        = bool
  default     = false
}

variable "maintenance_start_time" {
  description = "Daily maintenance window start time (UTC)"
  type        = string
  default     = "03:00"
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}
