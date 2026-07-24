output "key_ring_id" {
  description = "KMS key ring ID"
  value       = google_kms_key_ring.this.id
}

output "key_ids" {
  description = "Map of key name to crypto key ID"
  value       = { for k, v in google_kms_crypto_key.this : k => v.id }
}

output "key_names" {
  description = "Map of key name to fully qualified crypto key name"
  value       = { for k, v in google_kms_crypto_key.this : k => v.id }
}
