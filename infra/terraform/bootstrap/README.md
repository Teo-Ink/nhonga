# Bootstrap

Run once, by a human, before any other Terraform layer exists.

It creates the things the rest of the pipeline assumes are already there:

- the S3 bucket holding Terraform state, versioned and encrypted
- the DynamoDB table used for state locking
- the GitHub Actions OIDC provider
- the IAM roles CI assumes — one for `plan`, one per environment for `apply`

## Why this exists at all

So that CI never holds a long-lived AWS key.

GitHub mints a short-lived OIDC token for each job. AWS exchanges it for
temporary credentials only when the token's `sub` claim matches a role's trust
policy. There is no secret in the repository, nothing to rotate, and nothing
that keeps working if it leaks.

The production role trusts `repo:<owner>/<repo>:environment:production`.
GitHub does not put that claim in a token until the environment's protection
rules are satisfied, so adding a required reviewer to the `production`
environment makes the approval gate an IAM control rather than a line of YAML
that a repository admin could quietly edit.

## Order of operations

**1. Apply the bootstrap with local state.** It has to create the bucket before
it can store state in it.

```
cd infra/terraform/bootstrap
terraform init
terraform apply
```

**2. Move the bootstrap's own state into the bucket it just made.** Uncomment
the `backend "s3"` block in `versions.tf`, fill in the account id from the
output, then:

```
terraform init -migrate-state
```

**3. Wire GitHub.** From the `next_steps` output:

- create the `staging` and `production` environments in repository settings
- add **required reviewers** to `production` — without this the production role
  is only as strong as branch protection
- repository variable `AWS_PLAN_ROLE_ARN`
- environment variable `AWS_DEPLOY_ROLE_ARN` in each environment

**4. Delete the root account access keys.** Nothing needs them after this.
See the warning below.

## The root credentials problem

At the time of writing, this account's CLI is configured with **root account
access keys** (`arn:aws:iam::<account>:root`). Those keys can do anything,
cannot be scoped, cannot be restricted by permission boundaries, and are not
covered by the deny rules in `deploy-policy.tf`.

They must never be placed in GitHub secrets. That is the whole reason this
layer exists.

Once the OIDC roles work:

1. IAM → Security credentials → delete the root access keys
2. Create an IAM user or Identity Center login for day-to-day console work
3. Enable MFA on the root account and stop using it

## Cost

Effectively nothing: an S3 bucket holding a few hundred kilobytes, a
pay-per-request DynamoDB table taking a handful of writes per deploy, an OIDC
provider and four IAM roles. Under one US dollar a month.

The environment layers under `../envs/` are where real spend begins — see
`docs/phase-2-architecture/06-infrastructure.md` §7 for the estimate.

## What this layer deliberately does not do

It does not create the VPC, database, cluster or anything else an application
runs on. Those belong to `envs/staging` and `envs/production`, are applied by
CI rather than from a laptop, and are reviewed as a plan on a pull request
first.
