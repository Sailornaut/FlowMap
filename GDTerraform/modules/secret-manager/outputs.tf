output "secret_ids" {
  description = "Map of secret name to ID"
  value       = { for k, v in google_secret_manager_secret.this : k => v.id }
}

output "secret_names" {
  description = "Map of secret name to fully qualified name"
  value       = { for k, v in google_secret_manager_secret.this : k => v.name }
}
