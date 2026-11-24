# ─────────────────────────────────────────────────────────────────────────────
# Listing photos (P1-03 + P1-04).
#
# A private S3 bucket, readable only through a CloudFront distribution (origin
# access control), and writable only by the API's task role, under media/.
# Photos are immutable (an id is never reused), so CloudFront caches them for a
# year and most photo traffic never reaches the API, the ALB or the NAT.
# ─────────────────────────────────────────────────────────────────────────────

variable "project" { type = string }
variable "environment" { type = string }
variable "task_role_name" {
  description = "Name of the API task role that uploads and reads photos."
  type        = string
}
variable "price_class" {
  # PriceClass_All includes the Johannesburg edge, the closest to Mozambique.
  type    = string
  default = "PriceClass_All"
}
variable "cdn_enabled" {
  description = "Create the CloudFront distribution. Off: photos still go to the bucket and the API serves them (slower, no edge cache). Needed while the AWS account is not yet verified for CloudFront."
  type        = bool
  default     = true
}

locals {
  name = "${var.project}-${var.environment}-media"
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "media" {
  bucket = "${local.name}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Public listing photos: SSE-S3 is enough; a customer-managed key would add
# cost and a KMS call per photo for no confidentiality gain.
#trivy:ignore:AWS-0132
resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Deleted photos can be recovered for 30 days (a seller's mistake, an incident).
resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

resource "aws_cloudfront_origin_access_control" "media" {
  name                              = local.name
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# AWS managed policy "CachingOptimized".
data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

# Serves public, immutable photos from a private bucket (read-only GET/HEAD):
# no WAF needed on this distribution, and the default *.cloudfront.net
# certificate is used until the media domain exists.
#trivy:ignore:AWS-0011
#trivy:ignore:AWS-0013
#trivy:ignore:AWS-0010
resource "aws_cloudfront_distribution" "media" {
  count           = var.cdn_enabled ? 1 : 0
  enabled         = true
  comment         = "${local.name}: listing photos"
  price_class     = var.price_class
  is_ipv6_enabled = true

  origin {
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id                = "media"
    origin_access_control_id = aws_cloudfront_origin_access_control.media.id
  }

  default_cache_behavior {
    target_origin_id       = "media"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# The wildcards are an object prefix (media/*) and a TLS-only Deny on s3:*.
#trivy:ignore:AWS-0057
data "aws_iam_policy_document" "bucket" {
  dynamic "statement" {
    for_each = var.cdn_enabled ? [1] : []
    content {
      sid       = "CloudFrontReadsPhotos"
      actions   = ["s3:GetObject"]
      resources = ["${aws_s3_bucket.media.arn}/media/*"]
      principals {
        type        = "Service"
        identifiers = ["cloudfront.amazonaws.com"]
      }
      condition {
        test     = "StringEquals"
        variable = "AWS:SourceArn"
        values   = [aws_cloudfront_distribution.media[0].arn]
      }
    }
  }
  statement {
    sid     = "TLSOnly"
    effect  = "Deny"
    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.media.arn,
      "${aws_s3_bucket.media.arn}/*",
    ]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "media" {
  bucket     = aws_s3_bucket.media.id
  policy     = data.aws_iam_policy_document.bucket.json
  depends_on = [aws_s3_bucket_public_access_block.media]
}

# The API may write and read photos, and nothing else in AWS (least privilege).
# Object-level prefix (media/*): the API writes one object per photo id.
#trivy:ignore:AWS-0057
data "aws_iam_policy_document" "task" {
  statement {
    actions   = ["s3:PutObject", "s3:GetObject"]
    resources = ["${aws_s3_bucket.media.arn}/media/*"]
  }
}

resource "aws_iam_role_policy" "task_media" {
  name   = "${local.name}-rw"
  role   = var.task_role_name
  policy = data.aws_iam_policy_document.task.json
}

output "bucket" { value = aws_s3_bucket.media.bucket }
output "cdn_domain" {
  description = "CloudFront domain, or empty when the CDN is off."
  value       = var.cdn_enabled ? aws_cloudfront_distribution.media[0].domain_name : ""
}

moved {
  from = aws_cloudfront_distribution.media
  to   = aws_cloudfront_distribution.media[0]
}
