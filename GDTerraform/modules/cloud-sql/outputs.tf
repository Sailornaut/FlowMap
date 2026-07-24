output "instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.this.name
}

output "instance_connection_name" {
  description = "Cloud SQL connection name (for Cloud SQL Proxy)"
  value       = google_sql_database_instance.this.connection_name
}

output "private_ip_address" {
  description = "Private IP address"
  value       = google_sql_database_instance.this.private_ip_address
}

output "database_name" {
  description = "Database name"
  value       = google_sql_database.this.name
}

output "master_password" {
  description = "Master user password"
  value       = random_password.master.result
  sensitive   = true
}
