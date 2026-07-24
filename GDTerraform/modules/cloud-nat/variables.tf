variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "network_id" {
  description = "VPC network ID"
  type        = string
}

variable "router_name" {
  description = "Cloud Router name"
  type        = string
}

variable "nat_name" {
  description = "Cloud NAT name"
  type        = string
}

variable "min_ports_per_vm" {
  description = "Minimum NAT ports per VM"
  type        = number
  default     = 64
}

variable "max_ports_per_vm" {
  description = "Maximum NAT ports per VM (dynamic port allocation)"
  type        = number
  default     = 65536
}

variable "enable_dynamic_port_allocation" {
  description = "Enable dynamic port allocation"
  type        = bool
  default     = true
}
