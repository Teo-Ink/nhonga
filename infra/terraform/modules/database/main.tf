# RDS Postgres, private subnets, encrypted, Multi-AZ.
# Sizing from 06-infrastructure §7: db.t4g.medium Multi-AZ, 100GB gp3.
#
# The master password is generated here and never written to a variable file or
# committed. It is stored in Secrets Manager (secrets module) as the assembled
# DATABASE_URL, which is the only form the application ever reads.

variable "project" { type = string }
variable "environment" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "instance_class" {
  type    = string
  default = "db.t4g.medium"
}
variable "allocated_storage" {
  type    = number
  default = 100
}
variable "multi_az" {
  type    = bool
  default = true
}
variable "db_name" {
  type    = string
  default = "nhonga"
}
variable "db_username" {
  type    = string
  default = "nhonga"
}

locals { name = "${var.project}-${var.environment}" }

resource "random_password" "master" {
  length  = 32
  special = false # avoids URL-encoding hazards in the assembled DATABASE_URL
}

resource "aws_db_subnet_group" "this" {
  name       = local.name
  subnet_ids = var.subnet_ids
  tags       = { Name = local.name }
}

resource "aws_db_parameter_group" "this" {
  name   = local.name
  family = "postgres16"

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # log any statement over 1s; slow queries in checkout are money
  }
  tags = { Name = local.name }
}

resource "aws_db_instance" "this" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.allocated_storage * 2
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.master.result

  multi_az               = var.multi_az
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.security_group_id]
  parameter_group_name   = aws_db_parameter_group.this.name

  # Backups and recovery per 06-infrastructure §6: daily automated + 5-min PITR,
  # 35-day retention.
  backup_retention_period   = 35
  backup_window             = "02:00-03:00"
  maintenance_window        = "sun:03:30-sun:04:30"
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name}-final"
  copy_tags_to_snapshot     = true

  performance_insights_enabled = true
  auto_minor_version_upgrade   = true

  tags = { Name = local.name }
}

output "address" { value = aws_db_instance.this.address }
output "port" { value = aws_db_instance.this.port }
output "db_name" { value = var.db_name }
output "username" { value = var.db_username }
output "password" {
  value     = random_password.master.result
  sensitive = true
}
