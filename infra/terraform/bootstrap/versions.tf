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
  # Run it once with local state, then uncomment this block and
  # `terraform init -migrate-state` to move the bootstrap state into the bucket
  # it just created. See README.md in this directory.
  #
  # backend "s3" {
  #   bucket         = "nhonga-tfstate-<account-id>"
  #   key            = "bootstrap/terraform.tfstate"
  #   region         = "af-south-1"
  #   dynamodb_table = "nhonga-tfstate-lock"
  #   encrypt        = true
  # }
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
