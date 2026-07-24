variable "instance_name" {
  description = "Cloud SQL instance name"
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

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_16"
}

variable "tier" {
  description = "Machine type (e.g., db-custom-2-7680)"
  type        = string
  default     = "db-custom-2-7680"
}

variable "availability_type" {
  description = "HA: REGIONAL, non-HA: ZONAL"
  type        = string
  default     = "REGIONAL"
}

variable "disk_size_gb" {
  description = "Initial disk size in GB"
  type        = number
  default     = 20
}

variable "disk_type" {
  description = "Disk type (PD_SSD or PD_HDD)"
  type        = string
  default     = "PD_SSD"
}

variable "disk_autoresize" {
  description = "Enable disk autoresize"
  type        = bool
  default     = true
}

variable "database_name" {
  description = "Default database name"
  type        = string
}

variable "master_username" {
  description = "Master user name"
  type        = string
}

variable "kms_key_id" {
  description = "Cloud KMS key ID for CMEK encryption"
  type        = string
}

variable "network_id" {
  description = "VPC network ID for private IP"
  type        = string
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "backup_start_time" {
  description = "Preferred backup start time (UTC)"
  type        = string
  default     = "03:00"
}

variable "enable_pitr" {
  description = "Enable point-in-time recovery"
  type        = bool
  default     = true
}

variable "transaction_log_retention_days" {
  description = "Transaction log retention for PITR (days)"
  type        = number
  default     = 7
}

variable "retained_backups" {
  description = "Number of backups to retain"
  type        = number
  default     = 30
}

variable "maintenance_day" {
  description = "Day for maintenance window (1=Mon, 7=Sun)"
  type        = number
  default     = 7
}

variable "maintenance_hour" {
  description = "Hour for maintenance window (UTC)"
  type        = number
  default     = 4
}

variable "labels" {
  description = "Labels to apply"
  type        = map(string)
  default     = {}
}

variable "private_service_access_dependency" {
  description = "Dependency on private service access connection"
  type        = any
  default     = null
}
