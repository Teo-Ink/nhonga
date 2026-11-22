# ─────────────────────────────────────────────────────────────────────────────
# Application secrets in Secrets Manager, injected into the ECS tasks at start
# (never baked into the image or shown in the task definition).
#
# Terraform owns the secret *containers* only. The values are written by a
# one-shot `aws secretsmanager put-secret-value` during apply (P0-14): a
# secret *version* resource would make every `plan` read the value back, and
# the plan role — which any pull request can assume — is denied secret reads
# on purpose. With this split, plans never touch secret material.
#
# Values Terraform generates (database URL, ops token) are written here; values
# only the owner has (gateway tokens) are put by hand, see
# docs/runbooks/segredos.md.
# ─────────────────────────────────────────────────────────────────────────────

variable "project" { type = string }
variable "environment" { type = string }
variable "region" {
  type    = string
  default = "af-south-1"
}
variable "db_host" { type = string }
variable "db_port" { type = number }
variable "db_name" { type = string }
variable "db_username" { type = string }
variable "db_password" {
  type      = string
  sensitive = true
}
variable "otp_dev_allowlist" {
  description = "Create the OTP_DEV_ALLOWLIST secret (environments with simulated SMS)."
  type        = bool
  default     = false
}
variable "external" {
  description = "Names of secrets whose values the owner puts by hand (e.g. PAWAPAY_API_TOKEN)."
  type        = set(string)
  default     = []
}

# RDS for PostgreSQL 15+ refuses unencrypted connections (rds.force_ssl=1), so
# the URL asks for TLS. "require" encrypts without verifying the server
# certificate; moving to verify-full needs the RDS CA bundle in the image.
locals {
  name         = "${var.project}-${var.environment}"
  database_url = "postgresql://${var.db_username}:${var.db_password}@${var.db_host}:${var.db_port}/${var.db_name}?sslmode=require"
}

# ── Generated values ─────────────────────────────────────────────────────────
resource "aws_secretsmanager_secret" "database_url" {
  name        = "${local.name}/DATABASE_URL"
  description = "Postgres connection string for the ${var.environment} API"
  # Recovery window so a mistaken delete can be undone.
  recovery_window_in_days = 7
}

resource "random_password" "admin_api_token" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "admin_api_token" {
  name                    = "${local.name}/ADMIN_API_TOKEN"
  description             = "Token for the ${var.environment} API ops endpoints (x-admin-token)"
  recovery_window_in_days = 7
}

# Writes the value when it changes (the trigger is a hash, so state never holds
# the value twice). The command runs on the apply runner with the deploy role.
resource "terraform_data" "put_database_url" {
  triggers_replace = [aws_secretsmanager_secret.database_url.arn, sha256(local.database_url)]
  provisioner "local-exec" {
    command = "aws secretsmanager put-secret-value --region \"$REGION\" --secret-id \"$ID\" --secret-string \"$VALUE\" >/dev/null"
    environment = {
      REGION = var.region
      ID     = aws_secretsmanager_secret.database_url.arn
      VALUE  = local.database_url
    }
  }
}

resource "terraform_data" "put_admin_api_token" {
  triggers_replace = [aws_secretsmanager_secret.admin_api_token.arn, sha256(random_password.admin_api_token.result)]
  provisioner "local-exec" {
    command = "aws secretsmanager put-secret-value --region \"$REGION\" --secret-id \"$ID\" --secret-string \"$VALUE\" >/dev/null"
    environment = {
      REGION = var.region
      ID     = aws_secretsmanager_secret.admin_api_token.arn
      VALUE  = random_password.admin_api_token.result
    }
  }
}

# The version resource used before P0-14: forget it without deleting the value.
removed {
  from = aws_secretsmanager_secret_version.database_url
  lifecycle {
    destroy = false
  }
}

# ── Test-environment sign-in allowlist (P0-05) ───────────────────────────────
# The numbers are set by hand (personal data, change often):
#   aws secretsmanager put-secret-value --secret-id <project>-<env>/OTP_DEV_ALLOWLIST \
#     --secret-string "84xxxxxxx,85xxxxxxx"
# A placeholder is written once so the task can start; it leaves sign-in open.
resource "aws_secretsmanager_secret" "otp_dev_allowlist" {
  count                   = var.otp_dev_allowlist ? 1 : 0
  name                    = "${local.name}/OTP_DEV_ALLOWLIST"
  description             = "Numbers allowed to sign in on ${var.environment} (simulated SMS)"
  recovery_window_in_days = 7
}

resource "terraform_data" "put_otp_placeholder" {
  count            = var.otp_dev_allowlist ? 1 : 0
  triggers_replace = [aws_secretsmanager_secret.otp_dev_allowlist[0].arn]
  provisioner "local-exec" {
    command = "aws secretsmanager put-secret-value --region \"$REGION\" --secret-id \"$ID\" --secret-string definir-numeros >/dev/null"
    environment = {
      REGION = var.region
      ID     = aws_secretsmanager_secret.otp_dev_allowlist[0].arn
    }
  }
}

# ── Owner-held values (gateway and SMS tokens) ──────────────────────────────
# Containers only: the owner puts each value once (runbooks/segredos.md). The
# API task cannot start until they exist, which is the point in production.
resource "aws_secretsmanager_secret" "external" {
  for_each                = var.external
  name                    = "${local.name}/${each.key}"
  description             = "${each.key} for the ${var.environment} API (set by the owner)"
  recovery_window_in_days = 7
}

output "database_url_arn" { value = aws_secretsmanager_secret.database_url.arn }
output "admin_api_token_arn" { value = aws_secretsmanager_secret.admin_api_token.arn }
output "otp_dev_allowlist_arn" {
  value = var.otp_dev_allowlist ? aws_secretsmanager_secret.otp_dev_allowlist[0].arn : null
}
output "external_arns" {
  value = { for k, s in aws_secretsmanager_secret.external : k => s.arn }
}
