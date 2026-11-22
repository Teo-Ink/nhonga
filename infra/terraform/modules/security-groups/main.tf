# Three tiers, each only reachable from the one in front of it:
#   internet -> alb (443/80) -> ecs tasks (app port) -> rds (5432)
# RDS is never reachable from the internet or the load balancer, only from the
# task security group.

variable "project" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "app_port" {
  type    = number
  default = 3000
}

locals { name = "${var.project}-${var.environment}" }

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Public load balancer"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from the internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTP, redirected to HTTPS at the listener"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  # Egress is defined by the separate rules below (only to the tasks).
  tags = { Name = "${local.name}-alb" }
}

resource "aws_security_group" "tasks" {
  name        = "${local.name}-tasks"
  description = "ECS Fargate tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "App traffic from the load balancer only"
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  # Egress is defined by the separate rules below (HTTPS out, Postgres to RDS).
  tags = { Name = "${local.name}-tasks" }
}

resource "aws_security_group" "database" {
  name        = "${local.name}-database"
  description = "RDS Postgres"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Postgres from the tasks only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.tasks.id]
  }
  # No egress rule: the database initiates nothing.
  tags = { Name = "${local.name}-database" }
}

# ── Egress rules ────────────────────────────────────────────────────────────
# Separate rule resources (not inline blocks) because the ALB and task groups
# reference each other. Amazon-provided DNS is not filtered by security groups,
# so no DNS rule is needed.

resource "aws_security_group_rule" "alb_to_tasks" {
  type                     = "egress"
  description              = "Load balancer to the tasks, app port only"
  security_group_id        = aws_security_group.alb.id
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.tasks.id
}

# The API must reach services that only exist on the public internet over
# HTTPS: PawaPay and PaySuite (payments), the SMS gateway, the AI providers,
# plus ECR/Secrets Manager/CloudWatch via the NAT gateway. Their IP ranges are
# not published or stable, so 443 to any address is required; every other port
# is closed. Narrow this with VPC endpoints / an egress proxy later.
#trivy:ignore:AWS-0104
resource "aws_security_group_rule" "tasks_https_out" {
  type              = "egress"
  description       = "HTTPS to payment, SMS and AWS APIs"
  security_group_id = aws_security_group.tasks.id
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "tasks_to_database" {
  type                     = "egress"
  description              = "Postgres to RDS only"
  security_group_id        = aws_security_group.tasks.id
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.database.id
}

output "alb_sg_id" { value = aws_security_group.alb.id }
output "tasks_sg_id" { value = aws_security_group.tasks.id }
output "database_sg_id" { value = aws_security_group.database.id }
