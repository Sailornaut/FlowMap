output "repository_ids" {
  description = "Map of repository name to ID"
  value       = { for k, v in google_artifact_registry_repository.this : k => v.id }
}

output "repository_urls" {
  description = "Map of repository name to Docker registry URL"
  value       = { for k, v in google_artifact_registry_repository.this : k => "${var.location}-docker.pkg.dev/${var.project_id}/${v.repository_id}" }
}
