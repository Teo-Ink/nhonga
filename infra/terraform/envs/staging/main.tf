# ─────────────────────────────────────────────────────────────────────────────
# Staging environment.
#
# Scaled-down production, not a different architecture (06-infrastructure §2):
# the same modules as production, a different tfvars. Applied by CI through the
# staging deploy role, never from a laptop.
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.70" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }

  # State lives in the bucket created by ../../bootstrap. The account id is
  # filled in by `terraform init -backend-config=...` in CI so this file carries
  # no account-specific value.
  backend "s3" {
    key            = "envs/staging/terraform.tfstate"
    region         = "af-south-1"
    dynamodb_table = "nhonga-tfstate-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = "nhonga"
      Environment = "staging"
      ManagedBy   = "terraform"
    }
  }
}

variable "region" {
  type    = string
  default = "af-south-1"
}
variable "image_tag" {
  type        = string
  default     = "latest"
  description = "The api image tag to deploy. The deploy pipeline overrides this per release."
}
variable "certificate_arn" {
  type        = string
  default     = ""
  description = "ACM cert for HTTPS. Empty until the domain is registered (OQ-1); ALB serves HTTP:80 until then."
}

data "aws_caller_identity" "current" {}

locals {
  project = "nhonga"
  env     = "staging"
  azs     = ["af-south-1a", "af-south-1b"]
  ecr_url = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.region}.amazonaws.com/${local.project}-api"
}

module "network" {
  source      = "../../modules/network"
  project     = local.project
  environment = local.env
  azs         = local.azs
}

module "security_groups" {
  source      = "../../modules/security-groups"
  project     = local.project
  environment = local.env
  vpc_id      = module.network.vpc_id
  app_port    = 3000
}

module "database" {
  source            = "../../modules/database"
  project           = local.project
  environment       = local.env
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.security_groups.database_sg_id
  # Staging is scaled down: single-AZ, smaller instance.
  instance_class = "db.t4g.small"
  multi_az       = false
}

module "secrets" {
  source      = "../../modules/secrets"
  project     = local.project
  environment = local.env
  db_host     = module.database.address
  db_port     = module.database.port
  db_name     = module.database.db_name
  db_username = module.database.username
  db_password = module.database.password
}

module "alb" {
  source            = "../../modules/alb"
  project           = local.project
  environment       = local.env
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  security_group_id = module.security_groups.alb_sg_id
  app_port          = 3000
  certificate_arn   = var.certificate_arn
}

# Container registry for the api image (shared across environments; created here
# so staging is self-contained on first apply).
resource "aws_ecr_repository" "api" {
  name                 = "${local.project}-api"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecs_cluster" "this" {
  name = "${local.project}-${local.env}"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

module "api" {
  source            = "../../modules/ecs-service"
  project           = local.project
  environment       = local.env
  service_name      = "api"
  cluster_arn       = aws_ecs_cluster.this.arn
  cluster_name      = aws_ecs_cluster.this.name
  image             = "${local.ecr_url}:${var.image_tag}"
  app_port          = 3000
  region            = var.region
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.security_groups.tasks_sg_id
  target_group_arn  = module.alb.target_group_arn
  # Staging runs a lighter floor.
  desired_count = 1
  min_count     = 1
  max_count     = 4
  environment_vars = {
    PAYMENTS_MODE = "mock"
    LOG_LEVEL     = "debug"
  }
  secret_arns = {
    DATABASE_URL = module.secrets.database_url_arn
  }
}

output "alb_dns_name" { value = module.alb.dns_name }
output "ecr_repository_url" { value = aws_ecr_repository.api.repository_url }
output "cluster_name" { value = aws_ecs_cluster.this.name }
