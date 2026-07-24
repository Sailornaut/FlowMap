output "network_id" {
  description = "VPC network ID"
  value       = google_compute_network.this.id
}

output "network_name" {
  description = "VPC network name"
  value       = google_compute_network.this.name
}

output "network_self_link" {
  description = "VPC network self link"
  value       = google_compute_network.this.self_link
}

output "private_subnet_ids" {
  description = "Map of private subnet name to ID"
  value       = { for k, v in google_compute_subnetwork.private : k => v.id }
}

output "private_subnet_self_links" {
  description = "Map of private subnet name to self link"
  value       = { for k, v in google_compute_subnetwork.private : k => v.self_link }
}

output "private_subnet_names" {
  description = "Map of private subnet name to name"
  value       = { for k, v in google_compute_subnetwork.private : k => v.name }
}

output "data_subnet_ids" {
  description = "Map of data subnet name to ID"
  value       = { for k, v in google_compute_subnetwork.data : k => v.id }
}
