terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }

  # Bootstrap is the chicken-and-egg layer: it CREATES the state bucket and lock
  # table that every other layer uses, so it cannot itself start in S3.
  # It was applied once with local state; this block was then enabled and
  # `terraform init -migrate-state` moved the state into the bucket it created.
  # See README.md in this directory.
  backend "s3" {
    bucket         = "nhonga-tfstate-526156223765"
    key            = "bootstrap/terraform.tfstate"
    region         = "af-south-1"
    dynamodb_table = "nhonga-tfstate-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project    = "nhonga"
      Layer      = "bootstrap"
      ManagedBy  = "terraform"
      Repository = var.github_repository
    }
  }
}
