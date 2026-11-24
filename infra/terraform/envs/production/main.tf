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
    key            = "envs/production/terraform.tfstate"
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
      Environment = "production"
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
# Error tracking (P0-13). Empty = off. The DSN only allows sending events, so it
# is configuration, not a secret.
variable "sentry_dsn" {
  type    = string
  default = ""
}

variable "domain" {
  type        = string
  default     = "nhonga.co.mz"
  description = "Site domain; the API answers at api.<domain> (P0-08)."
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
  description = "ACM cert for HTTPS on the registered domain (OQ-1). Required: production never serves HTTP only."

  # A check block only warns and lets apply go ahead; validation stops plan and
  # apply when the certificate is missing (SEC-05).
  validation {
    condition     = can(regex("^arn:aws:acm:[a-z0-9-]+:[0-9]{12}:certificate/.+$", var.certificate_arn))
    error_message = "production requires certificate_arn: the ARN of an ACM certificate for the registered domain (OQ-1). Refusing to plan an HTTP-only production load balancer."
  }
}

data "aws_caller_identity" "current" {}

locals {
  project = "nhonga"
  env     = "production"
  azs     = ["af-south-1a", "af-south-1b"]
  ecr_url = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.region}.amazonaws.com/${local.project}-api"
  web_ecr = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.region}.amazonaws.com/${local.project}-web"

  api_port = 3000
  web_port = 3001
}

module "network" {
  source      = "../../modules/network"
  project     = local.project
  environment = local.env
  azs         = local.azs

  # An AZ outage must not cut the other AZ off the internet (P2-12).
  nat_per_az = true
}

module "security_groups" {
  source      = "../../modules/security-groups"
  project     = local.project
  environment = local.env
  vpc_id      = module.network.vpc_id
  app_port    = local.api_port
  web_port    = local.web_port
}

module "database" {
  source            = "../../modules/database"
  project           = local.project
  environment       = local.env
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.security_groups.database_sg_id

  instance_class = "db.t4g.medium"
  multi_az       = true
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

  # Put by the owner (runbooks/segredos.md): external before the first
  # production deploy; optional (the assistant key) whenever it is ready.
  optional = ["ANTHROPIC_API_KEY"]
  external = ["PAWAPAY_API_TOKEN", "SMS_GATEWAY_URL", "SMS_GATEWAY_TOKEN"]
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

  # Site and API on one HTTPS listener, routed by host (P0-08).
  web_port = local.web_port
  api_host = "api.${var.domain}"

  # Access logs for 5 years (INTIC regulation, Decreto 59/2023 art. 42).
  access_log_retention_days = 1825
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

resource "aws_service_discovery_private_dns_namespace" "internal" {
  name        = "${local.project}-${local.env}.local"
  description = "Service-to-service names for ${local.env}"
  vpc         = module.network.vpc_id
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

  desired_count = 2
  min_count     = 2
  max_count     = 8

  service_discovery              = true
  service_discovery_namespace_id = aws_service_discovery_private_dns_namespace.internal.id

  environment_vars = {
    # Real money and real SMS; the API refuses to start otherwise (SEC-08).
    PAYMENTS_MODE   = "live"
    CHECKOUT_MODE   = "live"
    CHECKOUT_BACKUP = "none" # PaySuite as backup once its contract exists
    SMS_MODE        = "live"
    SMS_SENDER_ID   = "Nhonga"
    PUBLIC_WEB_URL  = "https://${var.domain}"
    PUBLIC_API_URL  = "https://api.${var.domain}"
    CORS_ORIGINS    = "https://${var.domain}"
    LOG_LEVEL       = "info"
    APP_VERSION     = var.image_tag
    SENTRY_DSN      = var.sentry_dsn
    MEDIA_BUCKET    = module.media.bucket
    MEDIA_CDN_URL   = "https://${module.media.cdn_domain}"

    # Listings untouched for 90 days leave search (P2-10).
    LISTING_TTL_DAYS = "90"

    # Monthly ceiling on generative-AI tokens (SEC-08); review with real usage.
    ASSISTANT_MONTHLY_TOKEN_CAP = "2000000"
  }
  secret_arns = merge(
    {
      DATABASE_URL    = module.secrets.database_url_arn
      ADMIN_API_TOKEN = module.secrets.admin_api_token_arn
    },
    module.secrets.external_arns,
    module.secrets.optional_arns,
  )
}

# The site (P0-08): Next.js server and BFF, behind the same HTTPS listener.
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
  desired_count     = 2
  min_count         = 2
  max_count         = 6

  environment_vars = {
    NODE_ENV       = "production"
    API_URL        = "http://api.${aws_service_discovery_private_dns_namespace.internal.name}:${local.api_port}"
    SITE_URL       = "https://${var.domain}"
    SITE_INDEXABLE = "1"

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
output "ecr_repository_url" { value = aws_ecr_repository.api.repository_url }
output "cluster_name" { value = aws_ecs_cluster.this.name }

# Listing photos in S3 behind CloudFront (P1-03, P1-04).
module "media" {
  source         = "../../modules/media"
  project        = local.project
  environment    = local.env
  task_role_name = module.api.task_role_name
}

# Web application firewall on the load balancer (P2-05).
module "waf" {
  source      = "../../modules/waf"
  project     = local.project
  environment = local.env
  alb_arn     = module.alb.arn
}

# Account-wide CloudTrail and GuardDuty (P2-05), applied from production only.
module "account_security" {
  source          = "../../modules/account-security"
  project         = local.project
  alarm_topic_arn = module.alarms.topic_arn
}
