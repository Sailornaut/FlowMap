# ------------------------------------------------------------------------------
# Cloud DNS — Managed Zone
#
# Equivalent to AWS Route 53. Creates a public or private managed zone
# with optional DNSSEC signing.
# ------------------------------------------------------------------------------

resource "google_dns_managed_zone" "this" {
  name        = var.zone_name
  project     = var.project_id
  dns_name    = "${var.domain}."
  description = var.description
  visibility  = var.visibility

  dnssec_config {
    state = var.enable_dnssec ? "on" : "off"

    dynamic "default_key_specs" {
      for_each = var.enable_dnssec ? [1] : []
      content {
        algorithm  = "rsasha256"
        key_length = 2048
        key_type   = "keySigning"
      }
    }

    dynamic "default_key_specs" {
      for_each = var.enable_dnssec ? [1] : []
      content {
        algorithm  = "rsasha256"
        key_length = 1024
        key_type   = "zoneSigning"
      }
    }
  }

  # For private zones, bind to the specified VPC networks
  dynamic "private_visibility_config" {
    for_each = var.visibility == "private" ? [1] : []
    content {
      dynamic "networks" {
        for_each = var.private_visibility_networks
        content {
          network_url = networks.value
        }
      }
    }
  }

  labels = var.labels
}

# DNS records
resource "google_dns_record_set" "this" {
  for_each = var.records

  name         = each.value.name
  project      = var.project_id
  managed_zone = google_dns_managed_zone.this.name
  type         = each.value.type
  ttl          = each.value.ttl
  rrdatas      = each.value.rrdatas
}
