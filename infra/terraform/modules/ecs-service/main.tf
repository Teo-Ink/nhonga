# Reusable Fargate service. One instantiation per app (api, web, webhooks,
# workers - 06-infrastructure §3). This is the api's shape; the others differ
# only in image, port, sizing and which secrets they receive.

variable "project" { type = string }
variable "environment" { type = string }
variable "service_name" { type = string }
variable "cluster_arn" { type = string }
variable "cluster_name" { type = string }
variable "image" { type = string }
variable "app_port" {
  type    = number
  default = 3000
}
variable "cpu" {
  type    = number
  default = 512 # 0.5 vCPU (06-infrastructure §7)
}
variable "memory" {
  type    = number
  default = 1024 # 1 GB
}
variable "desired_count" {
  type    = number
  default = 2
}
variable "min_count" {
  type    = number
  default = 2
}
variable "max_count" {
  type    = number
  default = 8
}
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "target_group_arn" { type = string }
variable "region" { type = string }
# Plain environment variables (non-secret).
variable "environment_vars" {
  type    = map(string)
  default = {}
}
# Secrets injected from Secrets Manager by ARN: { ENV_NAME = secret_arn }.
variable "secret_arns" {
  type    = map(string)
  default = {}
}
variable "health_check_path" {
  type    = string
  default = "/health/live"
}

locals {
  name = "${var.project}-${var.environment}-${var.service_name}"
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${local.name}"
  retention_in_days = 30
  tags              = { Name = local.name }
}

# ── Task execution role: what ECS needs to START the task ──
data "aws_iam_policy_document" "execution_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-exec"
  assume_role_policy = data.aws_iam_policy_document.execution_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Only the specific secrets this service is given, nothing wider.
data "aws_iam_policy_document" "execution_secrets" {
  count = length(var.secret_arns) > 0 ? 1 : 0
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = values(var.secret_arns)
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  count  = length(var.secret_arns) > 0 ? 1 : 0
  name   = "read-injected-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets[0].json
}

# ── Task role: what the APPLICATION itself may do in AWS ──
# Empty by design. The API talks to Postgres and Redis over the network, not
# through the AWS API. A permission is added here only when the code genuinely
# needs one (e.g. KMS decrypt for the field cipher, once that is built).
resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.execution_assume.json
}

resource "aws_ecs_task_definition" "this" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = var.service_name
      image     = var.image
      essential = true
      portMappings = [
        { containerPort = var.app_port, protocol = "tcp" }
      ]
      environment = [
        for k, v in merge({ PORT = tostring(var.app_port), NODE_ENV = var.environment }, var.environment_vars) :
        { name = k, value = v }
      ]
      secrets = [
        for k, arn in var.secret_arns : { name = k, valueFrom = arn }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.this.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = var.service_name
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:${var.app_port}${var.health_check_path}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 20
      }
    }
  ])
  tags = { Name = local.name }
}

resource "aws_ecs_service" "this" {
  name            = var.service_name
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # Rolling deploy with circuit breaker + auto-rollback (06-infrastructure §5):
  # a new task set must pass health checks before old tasks drain.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.service_name
    container_port   = var.app_port
  }

  # Give a new task time to boot and pass health checks before the LB counts it.
  health_check_grace_period_seconds = 30

  lifecycle {
    # The image tag is advanced by the deploy pipeline, not by terraform apply.
    ignore_changes = [task_definition]
  }
  tags = { Name = local.name }
}

# ── Autoscaling: target-track CPU between min and max ──
resource "aws_appautoscaling_target" "this" {
  max_capacity       = var.max_count
  min_capacity       = var.min_count
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.this.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${local.name}-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.this.resource_id
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension
  service_namespace  = aws_appautoscaling_target.this.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60
    scale_in_cooldown  = 120
    scale_out_cooldown = 30
  }
}

output "service_name" { value = aws_ecs_service.this.name }
output "task_definition_arn" { value = aws_ecs_task_definition.this.arn }
output "log_group" { value = aws_cloudwatch_log_group.this.name }
