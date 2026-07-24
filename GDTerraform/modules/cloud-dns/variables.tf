variable "zone_name" {
  description = "DNS managed zone name"
  type        = string
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "domain" {
  description = "Domain name (without trailing dot)"
  type        = string
}

variable "description" {
  description = "Zone description"
  type        = string
  default     = "Managed by Terraform"
}

variable "visibility" {
  description = "Zone visibility (public or private)"
  type        = string
  default     = "public"
}

variable "enable_dnssec" {
  description = "Enable DNSSEC"
  type        = bool
  default     = true
}

variable "private_visibility_networks" {
  description = "VPC network URLs for private zone visibility"
  type        = list(string)
  default     = []
}

variable "records" {
  description = "DNS records to create"
  type = map(object({
    name    = string
    type    = string
    ttl     = optional(number, 300)
    rrdatas = list(string)
  }))
  default = {}
}

variable "labels" {
  description = "Labels to apply"
  type        = map(string)
  default     = {}
}
