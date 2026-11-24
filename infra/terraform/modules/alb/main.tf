# Public Application Load Balancer fronting one target group of Fargate tasks.
#
# HTTPS is conditional on a certificate. The domain (nhonga.co.mz) is not yet
# registered - see OPEN_QUESTIONS OQ-1 - so there is no ACM certificate to
# attach. When certificate_arn is empty the listener serves HTTP:80 directly so
# staging is reachable; when it is set, 80 redirects to 443 and the certificate
# terminates TLS. No plaintext-in-production path is baked in: production simply
# must be given a certificate_arn.

variable "project" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "app_port" {
  type    = number
  default = 3000
}
variable "health_check_path" {
  type    = string
  default = "/health/ready"
}
variable "certificate_arn" {
  type    = string
  default = ""
}
# Optional web app behind the same load balancer. When web_port is set, the
# web target group becomes the default route and the api stays reachable from
# the web tasks directly (service discovery) and, optionally, on
# api_public_port for the mobile app and webhooks.
variable "web_port" {
  type    = number
  default = 0
}
variable "web_health_check_path" {
  type    = string
  default = "/api/health"
}
variable "api_public_port" {
  description = "Plain-HTTP listener forwarding to the api, for environments without a certificate. 0 for none."
  type        = number
  default     = 0
}

variable "api_host" {
  description = "Host name of the API (e.g. api.nhonga.co.mz). With HTTPS and the web app on this ALB, requests for this host go to the API."
  type        = string
  default     = ""
}

variable "access_log_retention_days" {
  description = "Keep ALB access logs in S3 for this many days (0 = off). The INTIC regulation (Decreto 59/2023, art. 42) asks for 5 years of access logs."
  type        = number
  default     = 0
}

locals {
  name     = "${var.project}-${var.environment}"
  https_on = var.certificate_arn != ""
  web_on   = var.web_port > 0
}

# The public entry point of the platform: it must be internet-facing. Only the
# listener ports are open (security-groups module), and tasks/RDS stay private.
#trivy:ignore:AWS-0053
resource "aws_lb" "this" {
  name               = local.name
  load_balancer_type = "application"
  internal           = false
  subnets            = var.public_subnet_ids
  security_groups    = [var.security_group_id]

  drop_invalid_header_fields = true
  enable_deletion_protection = var.environment == "production"
  tags                       = { Name = local.name }

  dynamic "access_logs" {
    for_each = var.access_log_retention_days > 0 ? [1] : []
    content {
      bucket  = aws_s3_bucket.access_logs[0].id
      prefix  = "alb"
      enabled = true
    }
  }

  # The bucket policy must exist before the ALB validates log delivery.
  depends_on = [aws_s3_bucket_policy.access_logs]
}

# ── Access logs (LEG-02) ─────────────────────────────────────────────────────
# Who requested what and when (client IP, time, path, status), kept for the
# period the INTIC regulation asks. Private bucket, moved to cold storage after
# 90 days and deleted when the retention period ends.
data "aws_caller_identity" "current" {}
data "aws_elb_service_account" "this" {}

# Logging a log bucket would loop; versioning adds cost for write-once objects.
#trivy:ignore:AWS-0089
#trivy:ignore:AWS-0090
resource "aws_s3_bucket" "access_logs" {
  count  = var.access_log_retention_days > 0 ? 1 : 0
  bucket = "${local.name}-access-logs-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "access_logs" {
  count                   = var.access_log_retention_days > 0 ? 1 : 0
  bucket                  = aws_s3_bucket.access_logs[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ALB log delivery only supports SSE-S3 (not a customer-managed KMS key).
#trivy:ignore:AWS-0132
resource "aws_s3_bucket_server_side_encryption_configuration" "access_logs" {
  count  = var.access_log_retention_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.access_logs[0].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "access_logs" {
  count  = var.access_log_retention_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.access_logs[0].id
  rule {
    id     = "retain-then-expire"
    status = "Enabled"
    filter {}

    dynamic "transition" {
      for_each = var.access_log_retention_days > 90 ? [1] : []
      content {
        days          = 90
        storage_class = "GLACIER_IR"
      }
    }
    expiration {
      days = var.access_log_retention_days
    }
  }
}

data "aws_iam_policy_document" "access_logs" {
  count = var.access_log_retention_days > 0 ? 1 : 0

  statement {
    sid       = "AlbLogDelivery"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.access_logs[0].arn}/alb/AWSLogs/${data.aws_caller_identity.current.account_id}/*"]
    principals {
      type        = "AWS"
      identifiers = [data.aws_elb_service_account.this.arn]
    }
  }

  statement {
    sid       = "TlsOnly"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.access_logs[0].arn, "${aws_s3_bucket.access_logs[0].arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "access_logs" {
  count  = var.access_log_retention_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.access_logs[0].id
  policy = data.aws_iam_policy_document.access_logs[0].json
}

resource "aws_lb_target_group" "app" {
  name        = local.name
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip" # Fargate awsvpc networking registers task ENIs by IP

  health_check {
    path                = var.health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15
    timeout             = 5
    matcher             = "200"
  }

  # Give in-flight requests time to finish when a task is being replaced.
  deregistration_delay = 30
  tags                 = { Name = local.name }
}

resource "aws_lb_target_group" "web" {
  count       = local.web_on ? 1 : 0
  name        = "${local.name}-web"
  port        = var.web_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = var.web_health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15
    timeout             = 5
    matcher             = "200"
  }

  deregistration_delay = 30
  tags                 = { Name = "${local.name}-web" }
}

locals {
  # Where the main listener sends traffic: the web app when there is one.
  default_target_group_arn = local.web_on ? aws_lb_target_group.web[0].arn : aws_lb_target_group.app.arn
}

# HTTP listener: redirect to HTTPS when a certificate exists, otherwise forward.
# Forwarding plain HTTP only happens without a certificate, i.e. staging before
# the domain exists (OQ-1). Production cannot take that path: envs/production
# refuses to apply without certificate_arn.
#trivy:ignore:AWS-0054
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  dynamic "default_action" {
    for_each = local.https_on ? [1] : []
    content {
      type = "redirect"
      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  dynamic "default_action" {
    for_each = local.https_on ? [] : [1]
    content {
      type             = "forward"
      target_group_arn = local.default_target_group_arn
    }
  }
}

resource "aws_lb_listener" "https" {
  count             = local.https_on ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = local.default_target_group_arn
  }
}

# Host-based routing (P0-08): with a domain, the site and the API share the
# HTTPS listener; api.<domain> goes to the API, everything else to the site.
resource "aws_lb_listener_rule" "api_host" {
  count        = local.https_on && local.web_on && var.api_host != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10

  condition {
    host_header {
      values = [var.api_host]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# The api on its own port while there is no certificate (and so no domain for
# host-based routing). Plain HTTP for the same reason as the listener above;
# with a certificate this listener is not created.
#trivy:ignore:AWS-0054
resource "aws_lb_listener" "api_public" {
  count             = var.api_public_port > 0 && !local.https_on ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = var.api_public_port
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

output "dns_name" { value = aws_lb.this.dns_name }
output "target_group_arn" { value = aws_lb_target_group.app.arn }
output "web_target_group_arn" { value = local.web_on ? aws_lb_target_group.web[0].arn : null }
output "zone_id" { value = aws_lb.this.zone_id }
# CloudWatch dimensions (alarms module).
output "arn_suffix" { value = aws_lb.this.arn_suffix }
output "target_group_arn_suffix" { value = aws_lb_target_group.app.arn_suffix }
output "web_target_group_arn_suffix" { value = local.web_on ? aws_lb_target_group.web[0].arn_suffix : null }
output "arn" { value = aws_lb.this.arn }
