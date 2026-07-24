output "zone_name" {
  description = "DNS zone name"
  value       = google_dns_managed_zone.this.name
}

output "name_servers" {
  description = "DNS zone name servers"
  value       = google_dns_managed_zone.this.name_servers
}

output "zone_id" {
  description = "DNS zone ID"
  value       = google_dns_managed_zone.this.id
}
