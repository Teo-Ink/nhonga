-- P0-06: a deleted account frees its phone number at once. The number is
-- replaced by "deleted:<id>", so the format check now applies to live
-- accounts only.
ALTER TABLE "app_user" DROP CONSTRAINT IF EXISTS "app_user_phone_format_check";
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_phone_format_check"
  CHECK ("status" = 'deleted' OR "phone_e164" ~ '^\+258[8][2-7][0-9]{7}$');

-- P0-18: blocks. A buyer blocks a shop, or a shop's member blocks a buyer.
-- Exactly one target per row.
CREATE TABLE IF NOT EXISTS "user_block" (
  "id" uuid PRIMARY KEY,
  "blocker_user_id" uuid NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE,
  "blocked_vendor_id" uuid REFERENCES "vendor"("id") ON DELETE CASCADE,
  "blocked_user_id" uuid REFERENCES "app_user"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_block_one_target_check"
    CHECK (("blocked_vendor_id" IS NULL) <> ("blocked_user_id" IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_block_vendor_key"
  ON "user_block" ("blocker_user_id", "blocked_vendor_id") WHERE "blocked_vendor_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "user_block_user_key"
  ON "user_block" ("blocker_user_id", "blocked_user_id") WHERE "blocked_user_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "user_block_blocked_user_idx" ON "user_block" ("blocked_user_id");
CREATE INDEX IF NOT EXISTS "user_block_blocked_vendor_idx" ON "user_block" ("blocked_vendor_id");
