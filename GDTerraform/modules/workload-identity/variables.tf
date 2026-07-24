variable "service_account_id" {
  description = "GCP service account ID (short name)"
  type        = string
}

variable "display_name" {
  description = "Service account display name"
  type        = string
}

variable "description" {
  description = "Service account description"
  type        = string
  default     = ""
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "k8s_namespace" {
  description = "Kubernetes namespace"
  type        = string
}

variable "k8s_service_account" {
  description = "Kubernetes service account name"
  type        = string
}

variable "project_roles" {
  description = "List of project-level IAM roles to grant"
  type        = list(string)
  default     = []
}

variable "custom_iam_bindings" {
  description = "Custom IAM bindings with optional conditions"
  type = map(object({
    role = string
    condition = optional(object({
      title       = string
      description = optional(string, "")
      expression  = string
    }))
  }))
  default = {}
}
