output "forwarding_rule_ip" {
  description = "Forwarding rule IP address"
  value       = google_compute_forwarding_rule.this.ip_address
}

output "forwarding_rule_id" {
  description = "Forwarding rule ID"
  value       = google_compute_forwarding_rule.this.id
}

output "backend_service_id" {
  description = "Backend service ID"
  value       = google_compute_backend_service.this.id
}

output "ssl_policy_id" {
  description = "SSL policy ID"
  value       = google_compute_ssl_policy.this.id
}
