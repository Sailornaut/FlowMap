variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "key_ring_name" {
  description = "Name for the KMS key ring"
  type        = string
}

variable "location" {
  description = "Location for the key ring"
  type        = string
}

variable "keys" {
  description = "Map of crypto key configurations"
  type = map(object({
    rotation_period  = optional(string, "7776000s") # 90 days
    purpose          = optional(string, "ENCRYPT_DECRYPT")
    algorithm        = optional(string, "GOOGLE_SYMMETRIC_ENCRYPTION")
    protection_level = optional(string, "SOFTWARE")
  }))
}

variable "key_iam_bindings" {
  description = "IAM bindings granting service agents encrypter/decrypter on specific keys"
  type = map(object({
    key_name = string
    member   = string
  }))
  default = {}
}

variable "labels" {
  description = "Labels to apply to keys"
  type        = map(string)
  default     = {}
}
