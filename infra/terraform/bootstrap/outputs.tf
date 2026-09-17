output "state_bucket" {
  description = "S3 bucket holding Terraform state. Put this in each environment's backend block."
  value       = aws_s3_bucket.tfstate.id
}

output "lock_table" {
  description = "DynamoDB table used for state locking."
  value       = aws_dynamodb_table.tfstate_lock.id
}

output "plan_role_arn" {
  description = "Set as AWS_PLAN_ROLE_ARN in GitHub repository variables."
  value       = aws_iam_role.gha_plan.arn
}

output "deploy_role_arns" {
  description = "Set as AWS_DEPLOY_ROLE_ARN in each GitHub environment's variables."
  value       = { for k, r in aws_iam_role.gha_apply : k => r.arn }
}

output "next_steps" {
  description = "What to do once this layer has been applied."
  value       = <<-EOT
    1. Create GitHub environments "staging" and "production" in the repository
       settings. Add required reviewers to production - that gate is what makes
       the production deploy role safe.
    2. Add repository variable AWS_PLAN_ROLE_ARN = ${aws_iam_role.gha_plan.arn}
    3. Add environment variable AWS_DEPLOY_ROLE_ARN in each environment.
    4. Delete the root account access keys. CI no longer needs them, and no
       human should be using them.
  EOT
}
