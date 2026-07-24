variable "bucket_name" {
  description = "GCS bucket name (globally unique)"
  type        = string
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Bucket location (US for IL5)"
  type        = string
  default     = "US"
}

variable "storage_class" {
  description = "Storage class"
  type        = string
  default     = "STANDARD"
}

variable "force_destroy" {
  description = "Allow force destroy"
  type        = bool
  default     = false
}

variable "kms_key_id" {
  description = "Cloud KMS key ID for CMEK encryption"
  type        = string
}

variable "versioning_enabled" {
  description = "Enable object versioning"
  type        = bool
  default     = true
}

variable "lifecycle_rules" {
  description = "Lifecycle rules"
  type = list(object({
    age_days = number
    action   = string # Delete, SetStorageClass
  }))
  default = []
}

variable "log_bucket" {
  description = "Bucket for access logs (null to disable)"
  type        = string
  default     = null
}

variable "log_object_prefix" {
  description = "Prefix for access log objects"
  type        = string
  default     = ""
}

variable "labels" {
  description = "Labels to apply"
  type        = map(string)
  default     = {}
}
