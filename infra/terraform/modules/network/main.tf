# ─────────────────────────────────────────────────────────────────────────────
# Network: VPC across two AZs with public and private subnets.
#
# Public subnets hold only the load balancer and the NAT gateway. Everything
# that runs the application - ECS tasks, RDS - sits in private subnets with no
# route from the internet. Outbound access (image pulls, provider callbacks the
# other way, package registries) goes through the single NAT gateway.
#
# One NAT, not one per AZ: the cost estimate (06-infrastructure §7) budgets a
# single $38 NAT. That is a deliberate cost/resilience trade at launch scale; a
# second NAT removes a cross-AZ dependency and should be revisited with real
# traffic.
# ─────────────────────────────────────────────────────────────────────────────

variable "project" {
  type = string
}
variable "environment" {
  type = string
}
variable "cidr" {
  type    = string
  default = "10.0.0.0/16"
}
variable "nat_per_az" {
  description = "One NAT gateway per AZ (production): an AZ outage does not cut the other AZ off the internet. One shared NAT otherwise (cheaper)."
  type        = bool
  default     = false
}

variable "azs" {
  type = list(string)
}

locals {
  name = "${var.project}-${var.environment}"
  # /20 public and /20 private per AZ, carved from the /16.
  public_subnets  = [for i, _ in var.azs : cidrsubnet(var.cidr, 4, i)]
  private_subnets = [for i, _ in var.azs : cidrsubnet(var.cidr, 4, i + 8)]
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = local.name }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = local.name }
}

resource "aws_subnet" "public" {
  count                   = length(var.azs)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = local.public_subnets[count.index]
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = false # the ALB gets its address explicitly; nothing else needs a public IP
  tags                    = { Name = "${local.name}-public-${var.azs[count.index]}", Tier = "public" }
}

resource "aws_subnet" "private" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = local.private_subnets[count.index]
  availability_zone = var.azs[count.index]
  tags              = { Name = "${local.name}-private-${var.azs[count.index]}", Tier = "private" }
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "${local.name}-nat" }
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = local.name }
  depends_on    = [aws_internet_gateway.this]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = { Name = "${local.name}-public" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this.id
  }
  tags = { Name = "${local.name}-private" }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Extra NAT gateways and route tables for the other AZs (nat_per_az, P2-12).
# AZ 0 keeps the original NAT and route table, so turning this on adds
# resources instead of replacing the ones in use.
locals {
  extra_azs = var.nat_per_az ? length(var.azs) - 1 : 0
}

resource "aws_eip" "nat_extra" {
  count  = local.extra_azs
  domain = "vpc"
  tags   = { Name = "${local.name}-nat-${var.azs[count.index + 1]}" }
}

resource "aws_nat_gateway" "extra" {
  count         = local.extra_azs
  allocation_id = aws_eip.nat_extra[count.index].id
  subnet_id     = aws_subnet.public[count.index + 1].id
  tags          = { Name = "${local.name}-${var.azs[count.index + 1]}" }
  depends_on    = [aws_internet_gateway.this]
}

resource "aws_route_table" "private_extra" {
  count  = local.extra_azs
  vpc_id = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.extra[count.index].id
  }
  tags = { Name = "${local.name}-private-${var.azs[count.index + 1]}" }
}

locals {
  # AZ i uses its own route table with nat_per_az, AZ 0's table otherwise.
  private_route_tables = concat([aws_route_table.private.id], aws_route_table.private_extra[*].id)
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = local.private_route_tables[var.nat_per_az ? count.index : 0]
}

# S3 through a gateway endpoint (free): image layers from ECR and listing
# photos never cross the NAT, which is billed per GB (P2-12).
data "aws_region" "current" {}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = local.private_route_tables
  tags              = { Name = "${local.name}-s3" }
}

output "vpc_id" {
  value = aws_vpc.this.id
}
output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}
output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}
