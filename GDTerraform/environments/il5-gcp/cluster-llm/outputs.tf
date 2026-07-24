output "llm_cluster_name" {
  value = module.gke_cluster.cluster_name
}

output "llm_cluster_endpoint" {
  value     = module.gke_cluster.cluster_endpoint
  sensitive = true
}

output "llm_cluster_ca_certificate" {
  value     = module.gke_cluster.cluster_ca_certificate
  sensitive = true
}

output "vllm_server_sa_email" {
  value = module.wi_vllm_server.service_account_email
}

output "vllm_server_31b_sa_email" {
  value = module.wi_vllm_server_31b.service_account_email
}

output "external_secrets_llm_sa_email" {
  value = module.wi_external_secrets_llm.service_account_email
}
