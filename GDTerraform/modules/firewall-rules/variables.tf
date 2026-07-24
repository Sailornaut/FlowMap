variable "name" {
  description = "Name prefix for firewall rules"
  type        = string
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "network_id" {
  description = "VPC network ID"
  type        = string
}

variable "internal_cidrs" {
  description = "Internal CIDR ranges (all subnets including secondary ranges)"
  type        = list(string)
}

variable "master_ipv4_cidr_blocks" {
  description = "GKE master CIDR blocks (for control plane to node communication)"
  type        = list(string)
}

variable "node_tags" {
  description = "Network tags applied to GKE nodes"
  type        = list(string)
  default     = ["gke-node"]
}

variable "health_check_ports" {
  description = "Ports to allow for GCP health checks"
  type        = list(string)
  default     = ["80", "443", "8443", "15021"]
}

variable "enable_iap_ssh" {
  description = "Enable IAP SSH access to nodes"
  type        = bool
  default     = true
}
