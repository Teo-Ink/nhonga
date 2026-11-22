variable "aws_region" {
  description = "Region for the state bucket and lock table. Matches D-16 (af-south-1, Cape Town)."
  type        = string
  default     = "af-south-1"
}

variable "github_repository" {
  description = "owner/repo that CI runs from. Used to scope the OIDC trust policy so that ONLY workflows in this repository can assume the deploy roles."
  type        = string
  default     = "Teo-Ink/nhonga"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Must be in owner/repo form, e.g. Teo-Ink/nhonga."
  }
}

variable "github_oidc_subject_prefix" {
  description = <<-EOT
    Start of the `sub` claim in GitHub's OIDC tokens for this repository.
    The repository uses GitHub's immutable subject format, which pins the owner
    and repository by numeric id as well as by name, so a renamed or recreated
    repository with the same name cannot assume these roles. Read it with:
      gh api repos/<owner>/<repo>/actions/oidc/customization/sub
  EOT
  type        = string
  default     = "repo:Teo-Ink@291932914/nhonga@1373752316"

  validation {
    condition     = startswith(var.github_oidc_subject_prefix, "repo:")
    error_message = "Must start with repo: as GitHub's sub claim does."
  }
}

variable "project" {
  description = "Resource name prefix."
  type        = string
  default     = "nhonga"
}

variable "state_bucket_noncurrent_retention_days" {
  description = "How long superseded Terraform state versions are retained. State history is the audit trail for infrastructure change; do not set this low."
  type        = number
  default     = 90
}
