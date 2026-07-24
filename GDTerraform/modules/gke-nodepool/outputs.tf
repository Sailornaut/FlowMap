output "node_pool_id" {
  description = "Node pool ID"
  value       = google_container_node_pool.this.id
}

output "node_pool_name" {
  description = "Node pool name"
  value       = google_container_node_pool.this.name
}
