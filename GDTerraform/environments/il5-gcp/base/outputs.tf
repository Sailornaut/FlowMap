# ==============================================================================
# Base Outputs — consumed by cluster and cluster-llm phases
# ==============================================================================

output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "network_id" {
  value = module.vpc.network_id
}

output "network_name" {
  value = module.vpc.network_name
}

output "network_self_link" {
  value = module.vpc.network_self_link
}

output "app_subnet_self_link" {
  value = module.vpc.private_subnet_self_links["${local.name_prefix}-app-nodes"]
}

output "llm_subnet_self_link" {
  value = module.vpc.private_subnet_self_links["${local.name_prefix}-llm-nodes"]
}

output "kms_key_ids" {
  value = module.kms.key_ids
}

output "node_service_account_email" {
  value = google_service_account.gke_nodes.email
}

output "keycloak_db_private_ip" {
  value = module.keycloak_database.private_ip_address
}

output "keycloak_db_connection_name" {
  value = module.keycloak_database.instance_connection_name
}

output "artifact_registry_urls" {
  value = module.artifact_registry.repository_urls
}

output "models_bucket_name" {
  value = module.models_bucket.bucket_name
}

output "models_bucket_url" {
  value = module.models_bucket.bucket_url
}

output "dns_zone_name" {
  value = module.dns.zone_name
}

output "dns_name_servers" {
  value = module.dns.name_servers
}

output "secret_ids" {
  value = module.secrets.secret_ids
}

output "domain" {
  value = var.domain
}
