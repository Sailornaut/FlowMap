variable "name" {
  description = "VPC network name"
  type        = string
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "private_subnets" {
  description = "Map of private subnet configs (GKE nodes)"
  type = map(object({
    cidr = string
    secondary_ranges = optional(list(object({
      name = string
      cidr = string
    })), [])
  }))
}

variable "data_subnets" {
  description = "Map of data subnet configs (Cloud SQL)"
  type = map(object({
    cidr = string
  }))
  default = {}
}

variable "proxy_only_subnet_cidr" {
  description = "CIDR for proxy-only subnet (internal HTTPS LB). Set null to skip."
  type        = string
  default     = null
}

variable "enable_private_service_access" {
  description = "Enable Private Service Access for Cloud SQL"
  type        = bool
  default     = true
}

variable "psa_prefix_length" {
  description = "Prefix length for Private Service Access IP range"
  type        = number
  default     = 20
}
