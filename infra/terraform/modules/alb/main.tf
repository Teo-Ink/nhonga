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
