variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Secret replication location (US region for IL5)"
  type        = string
}

variable "kms_key_id" {
  description = "Cloud KMS key for CMEK encryption"
  type        = string
}

variable "secrets" {
  description = "Map of secret configurations"
  type = map(object({
    value  = optional(string)
    labels = optional(map(string), {})
  }))
}

variable "secret_accessors" {
  description = "IAM members that can access specific secrets"
  type = map(object({
    secret_key = string
    member     = string
  }))
  default = {}
}

variable "labels" {
  description = "Labels to apply to all secrets"
  type        = map(string)
  default     = {}
}
