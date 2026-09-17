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
