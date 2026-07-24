output "service_account_email" {
  description = "GCP service account email"
  value       = google_service_account.this.email
}

output "service_account_id" {
  description = "GCP service account ID"
  value       = google_service_account.this.id
}

output "service_account_name" {
  description = "GCP service account fully qualified name"
  value       = google_service_account.this.name
}

output "k8s_annotation" {
  description = "Annotation to add to the K8s service account"
  value = {
    "iam.gke.io/gcp-service-account" = google_service_account.this.email
  }
}
