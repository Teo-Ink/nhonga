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
variable "web_image_tag" {
  type        = string
  default     = "latest"
  description = "The web image tag to deploy. The deploy pipeline advances it per release."
}
variable "alarm_email" {
  type        = string
  default     = ""
  description = "Email for CloudWatch alarm notifications (OPS-02). Empty: subscribe later."
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
  web_ecr = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.region}.amazonaws.com/${local.project}-web"

  web_port      = 3001
  api_port      = 3000
  api_http_port = 8080 # api on the load balancer until a domain exists (OQ-1)
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
  app_port    = local.api_port

  web_port        = local.web_port
  api_public_port = local.api_http_port
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

  # Simulated SMS shows the login code on screen: limit sign-in to the team (P0-05).
  otp_dev_allowlist = true

  # AI assistant: placeholder until the owner puts the key (runbooks/segredos.md).
  optional = ["ANTHROPIC_API_KEY", "SENTRY_DSN"]
}

module "alb" {
  source            = "../../modules/alb"
  project           = local.project
  environment       = local.env
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  security_group_id = module.security_groups.alb_sg_id
  app_port          = local.api_port
  certificate_arn   = var.certificate_arn

  web_port        = local.web_port
  api_public_port = local.api_http_port
}

# Private DNS inside the VPC: the web tasks reach the api as
# api.nhonga-staging.local without leaving the network.
resource "aws_service_discovery_private_dns_namespace" "internal" {
  name        = "${local.project}-${local.env}.local"
  description = "Service-to-service names for ${local.env}"
  vpc         = module.network.vpc_id
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

resource "aws_ecr_repository" "web" {
  name                 = "${local.project}-web"
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
  app_port          = local.api_port
  region            = var.region
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.security_groups.tasks_sg_id
  target_group_arn  = module.alb.target_group_arn
  # Staging runs a lighter floor.
  desired_count = 1
  min_count     = 1
  max_count     = 4

  service_discovery              = true
  service_discovery_namespace_id = aws_service_discovery_private_dns_namespace.internal.id

  # Staging tests the whole flow with simulated SMS and payments: the login
  # code is shown on screen and payments go through /pagamento/simulador. No
  # real money moves. NODE_ENV=staging (from the module) keeps the production
  # safety check off for exactly this reason.
  environment_vars = {
    PAYMENTS_MODE  = "mock"
    CHECKOUT_MODE  = "mock"
    SMS_MODE       = "mock"
    LOG_LEVEL      = "debug"
    APP_VERSION    = var.image_tag
    MEDIA_BUCKET   = module.media.bucket
    MEDIA_CDN_URL  = module.media.cdn_domain == "" ? "" : "https://${module.media.cdn_domain}"
    SEED_DEMO      = "1" # demo catalogue on first start of an empty database
    PUBLIC_WEB_URL = "http://${module.alb.dns_name}"
    PUBLIC_API_URL = "http://${module.alb.dns_name}:${local.api_http_port}"

    # The demo uses the real assistant: cap the monthly spend (AI-01).
    ASSISTANT_MONTHLY_TOKEN_CAP = "500000"
  }
  secret_arns = merge(
    {
      DATABASE_URL      = module.secrets.database_url_arn
      ADMIN_API_TOKEN   = module.secrets.admin_api_token_arn
      OTP_DEV_ALLOWLIST = module.secrets.otp_dev_allowlist_arn
    },
    module.secrets.optional_arns,
  )
}

module "web" {
  source            = "../../modules/ecs-service"
  project           = local.project
  environment       = local.env
  service_name      = "web"
  cluster_arn       = aws_ecs_cluster.this.arn
  cluster_name      = aws_ecs_cluster.this.name
  image             = "${local.web_ecr}:${var.web_image_tag}"
  app_port          = local.web_port
  region            = var.region
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.security_groups.tasks_sg_id
  target_group_arn  = module.alb.web_target_group_arn
  health_check_path = "/api/health"
  desired_count     = 1
  min_count         = 1
  max_count         = 3

  environment_vars = {
    # The Next.js server always runs as production; staging-ness lives in the
    # build arguments (demo mode) and in the api it talks to.
    NODE_ENV = "production"
    API_URL  = "http://api.${aws_service_discovery_private_dns_namespace.internal.name}:${local.api_port}"

    # No domain, so no HTTPS yet: browsers drop Secure cookies over plain
    # HTTP. Staging only; production always has a certificate.
    SESSION_COOKIE_INSECURE = "1"

    # The stand-in payment page for CHECKOUT_MODE=mock on the api.
    CHECKOUT_SIMULATOR = "1"

    # Photos come from the media CDN (P1-03); the CSP must allow it.
    IMAGE_HOSTS = module.media.cdn_domain
  }
}

module "alarms" {
  source                    = "../../modules/alarms"
  project                   = local.project
  environment               = local.env
  alarm_email               = var.alarm_email
  alb_arn_suffix            = module.alb.arn_suffix
  target_group_arn_suffixes = { api = module.alb.target_group_arn_suffix, web = module.alb.web_target_group_arn_suffix }
  cluster_name              = aws_ecs_cluster.this.name
  service_names             = ["api", "web"]
  db_identifier             = module.database.identifier
  db_allocated_storage_gb   = module.database.allocated_storage_gb
  api_log_group             = module.api.log_group
}

output "alb_dns_name" { value = module.alb.dns_name }
output "web_url" { value = "http://${module.alb.dns_name}" }
output "api_url" { value = "http://${module.alb.dns_name}:${local.api_http_port}" }
output "ecr_repository_url" { value = aws_ecr_repository.api.repository_url }
output "web_ecr_repository_url" { value = aws_ecr_repository.web.repository_url }
output "cluster_name" { value = aws_ecs_cluster.this.name }

# Listing photos in S3 behind CloudFront (P1-03, P1-04).
module "media" {
  source         = "../../modules/media"
  project        = local.project
  environment    = local.env
  task_role_name = module.api.task_role_name

  # Off until AWS verifies the account for CloudFront (the first apply failed
  # with "Your account must be verified"). Photos go to S3 and the API serves
  # them. Set to true and re-apply once AWS Support confirms.
  cdn_enabled = false
}

# Web application firewall on the load balancer (P2-05).
module "waf" {
  source      = "../../modules/waf"
  project     = local.project
  environment = local.env
  alb_arn     = module.alb.arn
}

# The assistant key was created at the top level by the demo hotfix (AI-00):
# move it into the module instead of recreating it (keeps the owner's value).
moved {
  from = aws_secretsmanager_secret.anthropic_api_key
  to   = module.secrets.aws_secretsmanager_secret.optional["ANTHROPIC_API_KEY"]
}

moved {
  from = terraform_data.anthropic_api_key_placeholder
  to   = module.secrets.terraform_data.put_optional_placeholder["ANTHROPIC_API_KEY"]
}
