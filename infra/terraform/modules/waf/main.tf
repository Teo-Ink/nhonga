# ─────────────────────────────────────────────────────────────────────────────
# Web application firewall on the ALB (P2-05).
#
# AWS managed rule groups (common exploits, known bad inputs, IP reputation)
# plus a per-IP rate limit. Managed rules start in COUNT mode: they log what
# they would block, so false positives (a listing description that looks like
# SQL, a 12 MB photo upload) can be seen before they can hurt a seller. Switch
# managed_rules_mode to "block" after two weeks of clean logs. The rate limit
# blocks from day one.
# ─────────────────────────────────────────────────────────────────────────────

variable "project" { type = string }
variable "environment" { type = string }
variable "alb_arn" { type = string }
variable "managed_rules_mode" {
  type    = string
  default = "count"
  validation {
    condition     = contains(["count", "block"], var.managed_rules_mode)
    error_message = "managed_rules_mode must be \"count\" or \"block\"."
  }
}
variable "rate_limit_per_5min" {
  # Generous: mobile networks put many people behind one IP (CGNAT).
  type    = number
  default = 3000
}

locals {
  name    = "${var.project}-${var.environment}"
  managed = ["AWSManagedRulesCommonRuleSet", "AWSManagedRulesKnownBadInputsRuleSet", "AWSManagedRulesAmazonIpReputationList"]
}

resource "aws_wafv2_web_acl" "this" {
  name  = local.name
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit-per-ip"
    priority = 1
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.rate_limit_per_5min
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = { for i, n in local.managed : n => i }
    content {
      name     = rule.key
      priority = 10 + rule.value
      override_action {
        dynamic "count" {
          for_each = var.managed_rules_mode == "count" ? [1] : []
          content {}
        }
        dynamic "none" {
          for_each = var.managed_rules_mode == "block" ? [1] : []
          content {}
        }
      }
      statement {
        managed_rule_group_statement {
          vendor_name = "AWS"
          name        = rule.key
          # Photo uploads are large JSON bodies by design (SEC-07 caps them).
          dynamic "rule_action_override" {
            for_each = rule.key == "AWSManagedRulesCommonRuleSet" ? ["SizeRestrictions_BODY"] : []
            content {
              name = rule_action_override.value
              action_to_use {
                count {}
              }
            }
          }
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${local.name}-${rule.key}"
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = local.name
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = var.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.this.arn
}

output "web_acl_arn" { value = aws_wafv2_web_acl.this.arn }
