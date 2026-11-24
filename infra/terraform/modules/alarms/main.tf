# Operational alarms (OPS-02). Every alarm notifies one SNS topic; subscribe an
# email (alarm_email) and, later, an SMS or chat integration. Thresholds are
# deliberately simple starting points; tune them from real traffic.
#
# Covered: load balancer 5xx and latency, ECS CPU and memory per service, RDS
# CPU, connections and free storage, and the SMS-pumping breaker that the API
# logs as "ALERT otp_global_limit_reached" (SEC-02).

variable "project" { type = string }
variable "environment" { type = string }
variable "alarm_email" {
  type        = string
  default     = ""
  description = "Email that receives alarm notifications. Empty: topic only (subscribe later)."
}
variable "alb_arn_suffix" { type = string }
variable "target_group_arn_suffixes" {
  type        = map(string)
  description = "Target groups to watch for unhealthy hosts, by name (e.g. api, web)."
}
variable "cluster_name" { type = string }
variable "service_names" { type = list(string) }
variable "db_identifier" { type = string }
variable "db_allocated_storage_gb" { type = number }
variable "api_log_group" {
  type        = string
  description = "CloudWatch log group of the api service (for log-based alarms)."
}
variable "latency_p95_seconds" {
  type    = number
  default = 2
}
variable "db_max_connections_alarm" {
  type        = number
  default     = 80
  description = "Alarm when DatabaseConnections exceeds this (db.t4g.small allows ~180)."
}

locals {
  name    = "${var.project}-${var.environment}"
  actions = [aws_sns_topic.alarms.arn]
}

# Alarm notifications carry no secrets; SSE-KMS would add cost for no gain.
#trivy:ignore:AWS-0095
resource "aws_sns_topic" "alarms" {
  name = "${local.name}-alarms"
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# ── Load balancer ───────────────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.name}-alb-target-5xx"
  alarm_description   = "Targets answered more than 10 5xx responses in 5 minutes."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  dimensions          = { LoadBalancer = var.alb_arn_suffix }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

resource "aws_cloudwatch_metric_alarm" "alb_elb_5xx" {
  alarm_name          = "${local.name}-alb-elb-5xx"
  alarm_description   = "The load balancer itself returned 5xx (no healthy target, timeouts)."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  dimensions          = { LoadBalancer = var.alb_arn_suffix }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

resource "aws_cloudwatch_metric_alarm" "alb_latency_p95" {
  alarm_name          = "${local.name}-alb-latency-p95"
  alarm_description   = "p95 response time above ${var.latency_p95_seconds}s for 15 minutes."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  dimensions          = { LoadBalancer = var.alb_arn_suffix }
  extended_statistic  = "p95"
  period              = 300
  evaluation_periods  = 3
  threshold           = var.latency_p95_seconds
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  for_each            = var.target_group_arn_suffixes
  alarm_name          = "${local.name}-${each.key}-unhealthy"
  alarm_description   = "${each.key}: at least one unhealthy target for 5 minutes."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  dimensions          = { LoadBalancer = var.alb_arn_suffix, TargetGroup = each.value }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

# ── ECS services ────────────────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  for_each            = toset(var.service_names)
  alarm_name          = "${local.name}-${each.key}-cpu"
  alarm_description   = "${each.key}: CPU above 85% for 15 minutes."
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  dimensions          = { ClusterName = var.cluster_name, ServiceName = each.key }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory" {
  for_each            = toset(var.service_names)
  alarm_name          = "${local.name}-${each.key}-memory"
  alarm_description   = "${each.key}: memory above 85% for 15 minutes."
  namespace           = "AWS/ECS"
  metric_name         = "MemoryUtilization"
  dimensions          = { ClusterName = var.cluster_name, ServiceName = each.key }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

# ── Database ────────────────────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${local.name}-rds-cpu"
  alarm_description   = "Database CPU above 80% for 15 minutes."
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  dimensions          = { DBInstanceIdentifier = var.db_identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${local.name}-rds-connections"
  alarm_description   = "Database connections above ${var.db_max_connections_alarm}."
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  dimensions          = { DBInstanceIdentifier = var.db_identifier }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = var.db_max_connections_alarm
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${local.name}-rds-free-storage"
  alarm_description   = "Database free storage below 20% of the allocated size."
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = { DBInstanceIdentifier = var.db_identifier }
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 1
  threshold           = var.db_allocated_storage_gb * 0.2 * 1024 * 1024 * 1024
  comparison_operator = "LessThanThreshold"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

# ── Application signals from logs ───────────────────────────────────────────
resource "aws_cloudwatch_log_metric_filter" "otp_global_limit" {
  name           = "${local.name}-otp-global-limit"
  log_group_name = var.api_log_group
  pattern        = "\"ALERT otp_global_limit_reached\""
  metric_transformation {
    name          = "OtpGlobalLimitReached"
    namespace     = "Nhonga/${var.environment}"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "otp_global_limit" {
  alarm_name          = "${local.name}-otp-global-limit"
  alarm_description   = "Login-code sending hit the global hourly cap: possible SMS pumping (SEC-02)."
  namespace           = "Nhonga/${var.environment}"
  metric_name         = aws_cloudwatch_log_metric_filter.otp_global_limit.metric_transformation[0].name
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.actions
}

resource "aws_cloudwatch_log_metric_filter" "api_errors" {
  name           = "${local.name}-api-errors"
  log_group_name = var.api_log_group
  pattern        = "?ERROR ?Error"
  metric_transformation {
    name          = "ApiErrorLines"
    namespace     = "Nhonga/${var.environment}"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "api_errors" {
  alarm_name          = "${local.name}-api-error-logs"
  alarm_description   = "More than 20 error log lines from the api in 5 minutes."
  namespace           = "Nhonga/${var.environment}"
  metric_name         = aws_cloudwatch_log_metric_filter.api_errors.metric_transformation[0].name
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 20
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.actions
}

# A payment that arrived with an amount different from what was asked goes to
# "review" instead of the wallet (P1-09). Someone must look at it the same day.
resource "aws_cloudwatch_log_metric_filter" "payment_review" {
  name           = "${local.name}-payment-review"
  log_group_name = var.api_log_group
  pattern        = "\"ALERT payment_review\""
  metric_transformation {
    name          = "PaymentsInReview"
    namespace     = "Nhonga/${var.environment}"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "payment_review" {
  alarm_name          = "${local.name}-payment-review"
  alarm_description   = "A payment needs manual review (amount mismatch or late payment) (P1-09)."
  namespace           = "Nhonga/${var.environment}"
  metric_name         = aws_cloudwatch_log_metric_filter.payment_review.metric_transformation[0].name
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.actions
}

# A refund the gateway refused (P2-02): the seller's credit was restored, but
# the payer is still waiting for their money.
resource "aws_cloudwatch_log_metric_filter" "refund_failed" {
  name           = "${local.name}-refund-failed"
  log_group_name = var.api_log_group
  pattern        = "\"ALERT refund_failed\""
  metric_transformation {
    name          = "RefundsFailed"
    namespace     = "Nhonga/${var.environment}"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "refund_failed" {
  alarm_name          = "${local.name}-refund-failed"
  alarm_description   = "A refund was refused by the payment gateway (P2-02)."
  namespace           = "Nhonga/${var.environment}"
  metric_name         = aws_cloudwatch_log_metric_filter.refund_failed.metric_transformation[0].name
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.actions
}

output "topic_arn" { value = aws_sns_topic.alarms.arn }
