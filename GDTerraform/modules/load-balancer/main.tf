# ------------------------------------------------------------------------------
# Internal HTTPS Load Balancer — IL5
#
# Equivalent to AWS ALB. Uses GCP's Envoy-based internal HTTPS LB
# with Google-managed or self-managed SSL certificate. Routes traffic
# to Istio ingress gateway on GKE.
#
# Traffic flow:
#   Client → Internal HTTPS LB (TLS termination) → Istio ingressgateway
#     → Gateway API HTTPRoute → backend services
# ------------------------------------------------------------------------------

# --- Google-managed SSL Certificate ---
resource "google_compute_managed_ssl_certificate" "this" {
  count = var.use_managed_cert ? 1 : 0

  name    = "${var.name}-cert"
  project = var.project_id

  managed {
    domains = var.certificate_domains
  }
}

# --- Self-managed SSL Certificate ---
resource "google_compute_ssl_certificate" "this" {
  count = var.use_managed_cert ? 0 : 1

  name        = "${var.name}-cert"
  project     = var.project_id
  private_key = var.ssl_private_key
  certificate = var.ssl_certificate
}

# --- Health Check ---
resource "google_compute_health_check" "this" {
  name    = "${var.name}-hc"
  project = var.project_id

  http_health_check {
    port         = var.health_check_port
    request_path = var.health_check_path
  }

  check_interval_sec  = 15
  timeout_sec         = 5
  healthy_threshold   = 2
  unhealthy_threshold = 3
}

# --- Backend Service ---
resource "google_compute_backend_service" "this" {
  name    = "${var.name}-backend"
  project = var.project_id

  protocol              = "HTTP"
  port_name             = var.backend_port_name
  timeout_sec           = 300
  health_checks         = [google_compute_health_check.this.id]
  load_balancing_scheme = var.internal ? "INTERNAL_MANAGED" : "EXTERNAL_MANAGED"

  log_config {
    enable      = true
    sample_rate = 1.0
  }

  dynamic "backend" {
    for_each = var.backend_negs
    content {
      group           = backend.value
      balancing_mode  = "RATE"
      max_rate_per_endpoint = 100
    }
  }
}

# --- URL Map ---
resource "google_compute_url_map" "this" {
  name            = "${var.name}-urlmap"
  project         = var.project_id
  default_service = google_compute_backend_service.this.id
}

# --- HTTPS Proxy ---
resource "google_compute_target_https_proxy" "this" {
  name    = "${var.name}-https-proxy"
  project = var.project_id
  url_map = google_compute_url_map.this.id

  ssl_certificates = var.use_managed_cert ? [
    google_compute_managed_ssl_certificate.this[0].id
  ] : [
    google_compute_ssl_certificate.this[0].id
  ]

  ssl_policy = google_compute_ssl_policy.this.id
}

# --- SSL Policy (TLS 1.2+ only for IL5) ---
resource "google_compute_ssl_policy" "this" {
  name            = "${var.name}-ssl-policy"
  project         = var.project_id
  profile         = "RESTRICTED"
  min_tls_version = "TLS_1_2"
}

# --- Forwarding Rule ---
resource "google_compute_forwarding_rule" "this" {
  name    = "${var.name}-fwd"
  project = var.project_id
  region  = var.internal ? var.region : null

  load_balancing_scheme = var.internal ? "INTERNAL_MANAGED" : "EXTERNAL_MANAGED"
  target                = google_compute_target_https_proxy.this.id
  port_range            = "443"
  network               = var.internal ? var.network_id : null
  subnetwork            = var.internal ? var.subnetwork_id : null
  ip_protocol           = "TCP"

  labels = var.labels
}

# --- HTTP to HTTPS Redirect ---
resource "google_compute_url_map" "redirect" {
  name    = "${var.name}-redirect"
  project = var.project_id

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  name    = "${var.name}-http-proxy"
  project = var.project_id
  url_map = google_compute_url_map.redirect.id
}

resource "google_compute_forwarding_rule" "http_redirect" {
  name    = "${var.name}-http-fwd"
  project = var.project_id
  region  = var.internal ? var.region : null

  load_balancing_scheme = var.internal ? "INTERNAL_MANAGED" : "EXTERNAL_MANAGED"
  target                = google_compute_target_http_proxy.redirect.id
  port_range            = "80"
  network               = var.internal ? var.network_id : null
  subnetwork            = var.internal ? var.subnetwork_id : null
  ip_protocol           = "TCP"

  labels = var.labels
}
