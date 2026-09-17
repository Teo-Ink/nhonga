# ─────────────────────────────────────────────────────────────────────────────
# GitHub Actions OIDC
#
# This exists so that CI never holds a long-lived AWS access key. GitHub mints
# a short-lived OIDC token per job; AWS exchanges it for temporary credentials
# only if the token's `sub` claim matches the conditions below. There is no
# secret to leak, rotate, or accidentally commit.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]

  # AWS stopped validating this thumbprint for GitHub in 2023 and now uses its
  # own trust store, but the API still requires a non-empty list. This is
  # GitHub's documented value; it is not a security control here.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "gha_assume_plan" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Any branch or pull request in THIS repository may run a plan. Plans are
    # read-only against infrastructure; the blast radius is disclosure, which
    # is why the plan role cannot read secret values (see policy below).
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:*"]
    }
  }
}

# Apply roles trust a GitHub *Environment*, not a branch. That matters: GitHub
# will not issue a token with `environment:production` in its sub claim until
# the environment's protection rules have been satisfied. Putting required
# reviewers on the production environment therefore enforces the manual
# approval gate from 06-infrastructure.md §4 at the identity layer, not merely
# in workflow YAML that a repository admin could edit.
data "aws_iam_policy_document" "gha_assume_apply" {
  for_each = toset(["staging", "production"])

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:environment:${each.key}"]
    }
  }
}

resource "aws_iam_role" "gha_plan" {
  name                 = "${var.project}-gha-terraform-plan"
  description          = "Terraform plan from GitHub Actions. Read-only on infrastructure; may take a state lock."
  assume_role_policy   = data.aws_iam_policy_document.gha_assume_plan.json
  max_session_duration = 3600
}

resource "aws_iam_role" "gha_apply" {
  for_each = toset(["staging", "production"])

  name                 = "${var.project}-gha-deploy-${each.key}"
  description          = "Terraform apply and ECS deploy for ${each.key}, via the GitHub environment of the same name."
  assume_role_policy   = data.aws_iam_policy_document.gha_assume_apply[each.key].json
  max_session_duration = 3600
}

# ── State access ─────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "tfstate_access" {
  statement {
    effect    = "Allow"
    actions   = ["s3:ListBucket", "s3:GetBucketVersioning"]
    resources = [aws_s3_bucket.tfstate.arn]
  }

  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.tfstate.arn}/*"]
  }

  statement {
    effect    = "Allow"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:DescribeTable"]
    resources = [aws_dynamodb_table.tfstate_lock.arn]
  }
}

resource "aws_iam_policy" "tfstate_access" {
  name        = "${var.project}-tfstate-access"
  description = "Read and write Terraform remote state, and take the DynamoDB lock."
  policy      = data.aws_iam_policy_document.tfstate_access.json
}

# ── Read-only for planning ───────────────────────────────────────────────────

resource "aws_iam_role_policy_attachment" "plan_readonly" {
  role       = aws_iam_role.gha_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# ReadOnlyAccess includes secretsmanager:GetSecretValue and kms:Decrypt. A plan
# does not need either, and any pull request from the repository can assume this
# role, so deny them explicitly. An inline deny beats a managed allow.
resource "aws_iam_role_policy" "plan_deny_secret_reads" {
  name = "deny-secret-material"
  role = aws_iam_role.gha_plan.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Deny"
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:BatchGetSecretValue",
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath",
        "kms:Decrypt",
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "plan_state" {
  role       = aws_iam_role.gha_plan.name
  policy_arn = aws_iam_policy.tfstate_access.arn
}

resource "aws_iam_role_policy_attachment" "apply_state" {
  for_each   = aws_iam_role.gha_apply
  role       = each.value.name
  policy_arn = aws_iam_policy.tfstate_access.arn
}
