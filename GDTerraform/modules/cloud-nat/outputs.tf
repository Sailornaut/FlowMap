output "router_id" {
  description = "Cloud Router ID"
  value       = google_compute_router.this.id
}

output "nat_id" {
  description = "Cloud NAT ID"
  value       = google_compute_router_nat.this.id
}
