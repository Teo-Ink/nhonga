# The application reads its database connection from Secrets Manager, injected
# into the ECS task at start (never baked into the image or the task definition
# environment, where it would be visible in the console and in CloudTrail).
#
# This module assembles the URL from the database module's outputs so the
# password never transits a variable file.

variable "project" { type = string }
variable "environment" { type = string }
variable "db_host" { type = string }
variable "db_port" { type = number }
variable "db_name" { type = string }
variable "db_username" { type = string }
variable "db_password" {
  type      = string
  sensitive = true
}

# RDS for PostgreSQL 15+ refuses unencrypted connections (rds.force_ssl=1), so
# the URL asks for TLS. "require" encrypts without verifying the server
# certificate; moving to verify-full needs the RDS CA bundle in the image.
locals {
  name         = "${var.project}-${var.environment}"
  database_url = "postgresql://${var.db_username}:${var.db_password}@${var.db_host}:${var.db_port}/${var.db_name}?sslmode=require"
}

resource "aws_secretsmanager_secret" "database_url" {
  name        = "${local.name}/DATABASE_URL"
  description = "Postgres connection string for the ${var.environment} API"
  # Recovery window so a mistaken delete can be undone; production leaks nothing
  # by deleting immediately.
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = local.database_url
}

output "database_url_arn" {
  value = aws_secretsmanager_secret.database_url.arn
}

# ── Ops access (SEC-09) ──────────────────────────────────────────────────────
# Shared secret for the ops endpoints (x-admin-token). Generated here, so it
# never exists in a file or a variable; read it with
#   aws secretsmanager get-secret-value --secret-id <project>-<env>/ADMIN_API_TOKEN
resource "random_password" "admin_api_token" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "admin_api_token" {
  name                    = "${local.name}/ADMIN_API_TOKEN"
  description             = "Token for the ${var.environment} API ops endpoints (x-admin-token)"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "admin_api_token" {
  secret_id     = aws_secretsmanager_secret.admin_api_token.id
  secret_string = random_password.admin_api_token.result
}

output "admin_api_token_arn" {
  value = aws_secretsmanager_secret.admin_api_token.arn
}

# ── Test-environment sign-in allowlist (P0-05) ───────────────────────────────
# Only for environments with simulated SMS. The numbers are set outside
# Terraform (they are personal data and change often):
#   aws secretsmanager put-secret-value --secret-id <project>-<env>/OTP_DEV_ALLOWLIST \
#     --secret-string "84xxxxxxx,85xxxxxxx"
# Until real numbers are set, the placeholder below leaves sign-in open.
variable "otp_dev_allowlist" {
  type    = bool
  default = false
}

resource "aws_secretsmanager_secret" "otp_dev_allowlist" {
  count                   = var.otp_dev_allowlist ? 1 : 0
  name                    = "${local.name}/OTP_DEV_ALLOWLIST"
  description             = "Numbers allowed to sign in on ${var.environment} (simulated SMS)"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "otp_dev_allowlist" {
  count         = var.otp_dev_allowlist ? 1 : 0
  secret_id     = aws_secretsmanager_secret.otp_dev_allowlist[0].id
  secret_string = "definir-numeros"
  lifecycle {
    ignore_changes = [secret_string]
  }
}

output "otp_dev_allowlist_arn" {
  value = var.otp_dev_allowlist ? aws_secretsmanager_secret.otp_dev_allowlist[0].arn : null
}
