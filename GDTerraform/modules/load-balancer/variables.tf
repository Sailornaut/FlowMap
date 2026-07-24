variable "name" {
  description = "Load balancer name prefix"
  type        = string
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region (for internal LB)"
  type        = string
}

variable "internal" {
  description = "Internal (true) or external (false) load balancer"
  type        = bool
  default     = false
}

variable "network_id" {
  description = "VPC network ID (for internal LB)"
  type        = string
  default     = null
}

variable "subnetwork_id" {
  description = "Subnetwork ID (for internal LB)"
  type        = string
  default     = null
}

variable "use_managed_cert" {
  description = "Use Google-managed SSL certificate"
  type        = bool
  default     = true
}

variable "certificate_domains" {
  description = "Domains for Google-managed certificate"
  type        = list(string)
  default     = []
}

variable "ssl_private_key" {
  description = "SSL private key PEM (for self-managed cert)"
  type        = string
  default     = null
  sensitive   = true
}

variable "ssl_certificate" {
  description = "SSL certificate PEM (for self-managed cert)"
  type        = string
  default     = null
}

variable "health_check_port" {
  description = "Health check port"
  type        = number
  default     = 15021
}

variable "health_check_path" {
  description = "Health check path"
  type        = string
  default     = "/healthz/ready"
}

variable "backend_port_name" {
  description = "Named port on the NEG/instance group"
  type        = string
  default     = "http"
}

variable "backend_negs" {
  description = "List of NEG self links to add as backends"
  type        = list(string)
  default     = []
}

variable "labels" {
  description = "Labels to apply"
  type        = map(string)
  default     = {}
}
