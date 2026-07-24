variable "display_name" {
  description = "Display name for the Assured Workloads environment"
  type        = string
}

variable "organization_id" {
  description = "GCP organization ID (numeric)"
  type        = string
}

variable "location" {
  description = "Assured Workloads location (US region)"
  type        = string
  default     = "us-central1"
}

variable "billing_account_id" {
  description = "Billing account ID (without 'billingAccounts/' prefix)"
  type        = string
}

variable "parent" {
  description = "Parent resource (e.g., organizations/123 or folders/456)"
  type        = string
}

variable "labels" {
  description = "Labels to apply"
  type        = map(string)
  default     = {}
}
