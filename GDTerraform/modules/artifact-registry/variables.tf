variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Artifact Registry location"
  type        = string
}

variable "repositories" {
  description = "Map of repository configurations"
  type = map(object({
    description    = optional(string, "")
    immutable_tags = optional(bool, true)
    cleanup_policies = optional(list(object({
      id     = string
      action = string # DELETE or KEEP
      condition = optional(object({
        tag_state  = optional(string)
        older_than = optional(string)
      }))
      keep_count = optional(number)
    })), [])
  }))
}

variable "kms_key_id" {
  description = "Cloud KMS key for CMEK encryption"
  type        = string
}

variable "vulnerability_scanning_sa" {
  description = "Service account for vulnerability scanning (null to skip)"
  type        = string
  default     = null
}

variable "labels" {
  description = "Labels to apply"
  type        = map(string)
  default     = {}
}
