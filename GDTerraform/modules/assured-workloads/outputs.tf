output "workload_id" {
  description = "Assured Workloads workload ID"
  value       = google_assured_workloads_workload.this.id
}

output "folder_id" {
  description = "The folder ID created by Assured Workloads"
  value       = [for r in google_assured_workloads_workload.this.resources : r.resource_id if r.resource_type == "CONSUMER_FOLDER"][0]
}
