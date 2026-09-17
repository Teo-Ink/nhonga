#!/usr/bin/env bash
#
# Wires GitHub to the AWS roles created by infra/terraform/bootstrap.
#
# Run AFTER:
#   1. gh auth login
#   2. terraform apply in infra/terraform/bootstrap
#
# Safe to re-run: every step is idempotent.
set -euo pipefail

REPO="${REPO:-Teo-Ink/nhonga}"
BOOTSTRAP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../terraform/bootstrap" && pwd)"

command -v gh >/dev/null || { echo "gh not found. Install the GitHub CLI first." >&2; exit 1; }
command -v terraform >/dev/null || { echo "terraform not found." >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Not logged in. Run: gh auth login" >&2; exit 1; }

echo "==> Reading role ARNs from Terraform state"
cd "$BOOTSTRAP_DIR"
PLAN_ROLE="$(terraform output -raw plan_role_arn)"
STAGING_ROLE="$(terraform output -json deploy_role_arns | sed -n 's/.*"staging":"\([^"]*\)".*/\1/p')"
PROD_ROLE="$(terraform output -json deploy_role_arns | sed -n 's/.*"production":"\([^"]*\)".*/\1/p')"

for v in PLAN_ROLE STAGING_ROLE PROD_ROLE; do
  [ -n "${!v}" ] || { echo "Could not read $v from terraform output. Has bootstrap been applied?" >&2; exit 1; }
done
echo "    plan:       $PLAN_ROLE"
echo "    staging:    $STAGING_ROLE"
echo "    production: $PROD_ROLE"

echo "==> Ensuring repository exists"
if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "    $REPO not visible. Create it with:"
  echo "      gh repo create $REPO --private --source=. --remote=origin"
  exit 1
fi

echo "==> Repository variable: AWS_PLAN_ROLE_ARN"
gh variable set AWS_PLAN_ROLE_ARN --repo "$REPO" --body "$PLAN_ROLE"

echo "==> Environments and their deploy roles"
for env in staging production; do
  # Creating an environment is a PUT, so this is idempotent.
  gh api -X PUT "repos/$REPO/environments/$env" >/dev/null
  case "$env" in
    staging)    ROLE="$STAGING_ROLE" ;;
    production) ROLE="$PROD_ROLE" ;;
  esac
  gh variable set AWS_DEPLOY_ROLE_ARN --repo "$REPO" --env "$env" --body "$ROLE"
  echo "    $env -> $ROLE"
done

cat <<'EOF'

==> Done. One thing left, and it must be done by hand:

    Settings > Environments > production > Required reviewers

    Add at least one. Until you do, the production deploy role can be assumed
    by any workflow run that targets the production environment - and that
    approval gate is the only thing standing between a merge and a change to
    live infrastructure. The IAM trust policy already requires the
    "environment:production" claim; GitHub only withholds that claim once a
    reviewer rule exists.

    While you are there, consider also enabling branch protection on main:
    require the CI checks to pass, and disallow force pushes.
EOF
