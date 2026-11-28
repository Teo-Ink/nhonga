-- AUTH-10: sign in with Google or Facebook, besides the phone number.
--
-- An account created through a provider has no phone until its owner
-- confirms one (asked for when they first publish a listing), so the phone
-- becomes optional. The format check still applies whenever one is present.
ALTER TABLE "app_user" ALTER COLUMN "phone_e164" DROP NOT NULL;
ALTER TABLE "app_user" DROP CONSTRAINT IF EXISTS "app_user_phone_format_check";
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_phone_format_check"
  CHECK ("status" = 'deleted' OR "phone_e164" IS NULL OR "phone_e164" ~ '^\+258[8][2-7][0-9]{7}$');

-- One row per provider account linked to a Nhonga account. `subject` is the
-- provider's stable id for the person (never the e-mail, which can change).
-- The e-mail is kept here for the owner's reference only: it is not used to
-- find or merge accounts.
CREATE TABLE IF NOT EXISTS "user_identity" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "subject" text NOT NULL,
  "email" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_identity_provider_check" CHECK ("provider" in ('google','facebook'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_identity_provider_subject_key"
  ON "user_identity" ("provider", "subject");
CREATE UNIQUE INDEX IF NOT EXISTS "user_identity_user_provider_key"
  ON "user_identity" ("user_id", "provider");
