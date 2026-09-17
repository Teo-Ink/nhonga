# ─────────────────────────────────────────────────────────────────────────────
# Permissions for the apply roles.
#
# An infrastructure-provisioning role is necessarily broad: it creates VPCs,
# databases, clusters and the IAM roles those services assume. Attempting to
# scope it by resource ARN fails in practice, because most of those ARNs do not
# exist until the role creates them.
#
# The real controls are therefore:
#   1. the OIDC sub condition - only this repository, only that environment;
#   2. GitHub environment protection rules - production requires a reviewer
#      before a token with that sub is ever minted;
#   3. an explicit deny on the account-destroying actions below, which no
#      deployment has a legitimate reason to perform.
#
# This is a deliberate trade-off and should be reviewed if the blast radius
# ever needs tightening further (for example by splitting network and data
# layers into separately-assumed roles).
# ─────────────────────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "deploy" {
  statement {
    sid    = "ProvisionApplicationInfrastructure"
    effect = "Allow"
    actions = [
      "ec2:*",         # VPC, subnets, security groups, NAT
      "rds:*",         # Postgres
      "elasticache:*", # Redis
      "es:*",          # OpenSearch
      "ecs:*",         # Fargate services and task definitions
      "ecr:*",         # container images
      "elasticloadbalancing:*",
      "application-autoscaling:*",
      "cloudfront:*",
      "acm:*",
      "wafv2:*",
      "route53:*",
      "s3:*",
      "secretsmanager:*",
      "kms:*",
      "logs:*",
      "cloudwatch:*",
      "sns:*",
      "events:*",
      "dynamodb:*",
      "servicediscovery:*",
    ]
    resources = ["*"]
  }

  # Creating the task execution and task roles that ECS assumes.
  statement {
    sid    = "ManageServiceLinkedAndTaskRoles"
    effect = "Allow"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:PassRole",
      "iam:TagRole",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:CreateServiceLinkedRole",
      "iam:CreatePolicy",
      "iam:DeletePolicy",
      "iam:GetPolicy",
      "iam:ListPolicyVersions",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicyVersion",
    ]
    resources = ["*"]
  }

  # Nothing a deployment does should require these. Denying them means a
  # compromised workflow cannot escalate out of the deployment blast radius or
  # quietly disable the audit trail.
  statement {
    sid    = "DenyAccountLevelEscalation"
    effect = "Deny"
    actions = [
      "iam:CreateUser",
      "iam:CreateAccessKey",
      "iam:CreateLoginProfile",
      "iam:UpdateLoginProfile",
      "iam:AttachUserPolicy",
      "iam:PutUserPolicy",
      "iam:DeleteUser",
      "iam:UpdateAssumeRolePolicy",
      "iam:CreateOpenIDConnectProvider",
      "iam:DeleteOpenIDConnectProvider",
      "iam:UpdateOpenIDConnectProviderThumbprint",
      "organizations:*",
      "account:*",
      "cloudtrail:DeleteTrail",
      "cloudtrail:StopLogging",
      "cloudtrail:UpdateTrail",
      "config:DeleteConfigurationRecorder",
      "config:StopConfigurationRecorder",
      "guardduty:DeleteDetector",
      "guardduty:UpdateDetector",
    ]
    resources = ["*"]
  }

  # The state bucket and lock table are managed by the bootstrap layer alone.
  # An environment apply must never be able to delete the record of what exists.
  statement {
    sid    = "ProtectTerraformStateInfrastructure"
    effect = "Deny"
    actions = [
      "s3:DeleteBucket",
      "s3:PutBucketPolicy",
      "s3:PutBucketVersioning",
      "dynamodb:DeleteTable",
    ]
    resources = [
      aws_s3_bucket.tfstate.arn,
      "${aws_s3_bucket.tfstate.arn}/*",
      aws_dynamodb_table.tfstate_lock.arn,
    ]
  }
}

resource "aws_iam_policy" "deploy" {
  name        = "${var.project}-deploy"
  description = "Infrastructure provisioning for Nhonga environments, minus account-level escalation."
  policy      = data.aws_iam_policy_document.deploy.json
}

resource "aws_iam_role_policy_attachment" "apply_deploy" {
  for_each   = aws_iam_role.gha_apply
  role       = each.value.name
  policy_arn = aws_iam_policy.deploy.arn
}
