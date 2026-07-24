# ------------------------------------------------------------------------------
# Core
# ------------------------------------------------------------------------------

variable "project_id" {
  description = "GCP project ID (inside the Assured Workloads folder)"
  type        = string
}

variable "region" {
  description = "GCP region (US region for IL5)"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "il5"
}

# ------------------------------------------------------------------------------
# Organization (for Assured Workloads)
# ------------------------------------------------------------------------------

variable "organization_id" {
  description = "GCP organization ID"
  type        = string
}

variable "billing_account_id" {
  description = "GCP billing account ID"
  type        = string
}

variable "assured_workloads_parent" {
  description = "Parent for Assured Workloads folder (e.g., organizations/123)"
  type        = string
}

# ------------------------------------------------------------------------------
# Domain
# ------------------------------------------------------------------------------

variable "domain" {
  description = "Application domain name"
  type        = string
  default     = "gameday.dla-lz.us"
}

# ------------------------------------------------------------------------------
# Networking
# ------------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "Primary CIDR for the VPC (node subnet)"
  type        = string
  default     = "10.0.0.0/20"
}

variable "pods_cidr" {
  description = "Secondary CIDR for GKE pods"
  type        = string
  default     = "10.4.0.0/14"
}

variable "services_cidr" {
  description = "Secondary CIDR for GKE services"
  type        = string
  default     = "10.8.0.0/20"
}

variable "data_subnet_cidr" {
  description = "CIDR for data subnet (Cloud SQL Private Service Access)"
  type        = string
  default     = "10.1.0.0/24"
}

variable "proxy_only_cidr" {
  description = "CIDR for proxy-only subnet (internal HTTPS LB)"
  type        = string
  default     = "10.2.0.0/24"
}

variable "llm_subnet_cidr" {
  description = "CIDR for LLM cluster nodes"
  type        = string
  default     = "10.3.0.0/20"
}

variable "llm_pods_cidr" {
  description = "Secondary CIDR for LLM cluster pods"
  type        = string
  default     = "10.12.0.0/14"
}

variable "llm_services_cidr" {
  description = "Secondary CIDR for LLM cluster services"
  type        = string
  default     = "10.16.0.0/20"
}

# ------------------------------------------------------------------------------
# Cloud SQL (Keycloak Database)
# ------------------------------------------------------------------------------

variable "keycloak_db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-custom-2-7680"
}

variable "keycloak_db_ha" {
  description = "Enable HA for Cloud SQL (REGIONAL for HA, ZONAL for single)"
  type        = string
  default     = "REGIONAL"
}

variable "keycloak_db_disk_size" {
  description = "Cloud SQL disk size in GB"
  type        = number
  default     = 20
}
