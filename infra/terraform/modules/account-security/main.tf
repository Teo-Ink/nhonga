# ─────────────────────────────────────────────────────────────────────────────
# Account-wide detection (P2-05): CloudTrail (who did what, in every region,
# tamper-evident) and GuardDuty (threat detection on the account, with S3
# protection). Applied once per AWS account — from the production stack.
# Findings of severity ≥ 7 go to the alarm topic.
# ─────────────────────────────────────────────────────────────────────────────

variable "project" { type = string }
variable "alarm_topic_arn" { type = string }

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "trail" {
  bucket = "${var.project}-cloudtrail-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "trail" {
  bucket                  = aws_s3_bucket.trail.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# SSE-S3 with log file validation (tamper evidence); a CMK can come later.
#trivy:ignore:AWS-0132
resource "aws_s3_bucket_server_side_encryption_configuration" "trail" {
  bucket = aws_s3_bucket.trail.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "trail" {
  bucket = aws_s3_bucket.trail.id
  rule {
    id     = "keep-one-year"
    status = "Enabled"
    filter {}
    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }
    expiration {
      days = 365
    }
  }
}

data "aws_iam_policy_document" "trail" {
  statement {
    sid       = "AclCheck"
    actions   = ["s3:GetBucketAcl"]
    resources = [aws_s3_bucket.trail.arn]
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
  }
  statement {
    sid       = "Write"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.trail.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }
  }
}

resource "aws_s3_bucket_policy" "trail" {
  bucket = aws_s3_bucket.trail.id
  policy = data.aws_iam_policy_document.trail.json
}

#trivy:ignore:AWS-0015
resource "aws_cloudtrail" "this" {
  name                          = "${var.project}-account"
  s3_bucket_name                = aws_s3_bucket.trail.id
  is_multi_region_trail         = true
  include_global_service_events = true
  enable_log_file_validation    = true
  depends_on                    = [aws_s3_bucket_policy.trail]
}

resource "aws_guardduty_detector" "this" {
  enable                       = true
  finding_publishing_frequency = "FIFTEEN_MINUTES"
}

resource "aws_guardduty_detector_feature" "s3" {
  detector_id = aws_guardduty_detector.this.id
  name        = "S3_DATA_EVENTS"
  status      = "ENABLED"
}

resource "aws_cloudwatch_event_rule" "guardduty_high" {
  name        = "${var.project}-guardduty-high"
  description = "GuardDuty findings of severity 7 or more"
  event_pattern = jsonencode({
    source        = ["aws.guardduty"]
    "detail-type" = ["GuardDuty Finding"]
    detail        = { severity = [{ numeric = [">=", 7] }] }
  })
}

resource "aws_cloudwatch_event_target" "guardduty_high" {
  rule = aws_cloudwatch_event_rule.guardduty_high.name
  arn  = var.alarm_topic_arn
}

# Replaces the topic's default policy, so it keeps what that allowed (the
# account itself, i.e. CloudWatch alarms) and adds EventBridge.
data "aws_iam_policy_document" "topic" {
  statement {
    sid       = "AccountPublishes"
    actions   = ["sns:Publish", "sns:Subscribe", "sns:GetTopicAttributes"]
    resources = [var.alarm_topic_arn]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }
  statement {
    sid       = "CloudWatchAlarms"
    actions   = ["sns:Publish"]
    resources = [var.alarm_topic_arn]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
  }
  statement {
    sid       = "EventBridge"
    actions   = ["sns:Publish"]
    resources = [var.alarm_topic_arn]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_sns_topic_policy" "events" {
  arn    = var.alarm_topic_arn
  policy = data.aws_iam_policy_document.topic.json
}

output "trail_bucket" { value = aws_s3_bucket.trail.bucket }
