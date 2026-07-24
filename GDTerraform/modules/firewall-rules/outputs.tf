output "internal_rule_id" {
  value = google_compute_firewall.allow_internal.id
}

output "master_rule_id" {
  value = google_compute_firewall.allow_master_to_nodes.id
}

output "health_check_rule_id" {
  value = google_compute_firewall.allow_health_checks.id
}
