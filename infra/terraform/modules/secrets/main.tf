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

locals {
  name         = "${var.project}-${var.environment}"
  database_url = "postgresql://${var.db_username}:${var.db_password}@${var.db_host}:${var.db_port}/${var.db_name}"
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
