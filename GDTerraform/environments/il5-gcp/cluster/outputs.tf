output "cluster_name" {
  value = module.gke_cluster.cluster_name
}

output "cluster_endpoint" {
  value     = module.gke_cluster.cluster_endpoint
  sensitive = true
}

output "cluster_ca_certificate" {
  value     = module.gke_cluster.cluster_ca_certificate
  sensitive = true
}

output "workload_identity_pool" {
  value = module.gke_cluster.workload_identity_pool
}

output "external_secrets_sa_email" {
  value = module.wi_external_secrets.service_account_email
}

output "cert_manager_sa_email" {
  value = module.wi_cert_manager.service_account_email
}

output "load_balancer_ip" {
  value = module.load_balancer.forwarding_rule_ip
}
