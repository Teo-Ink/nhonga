-- LEG-02: complaints channel. The INTIC regulation (Decreto 59/2023, art. 45)
-- asks platform operators to keep a complaints system for 5 years. A complaint
-- is kept even if the account is later deleted (user_id is set null).
CREATE TABLE IF NOT EXISTS "complaint" (
  "id" uuid PRIMARY KEY,
  "reference" text NOT NULL UNIQUE,
  "user_id" uuid REFERENCES "app_user"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "contact" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "resolution" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "resolved_at" timestamptz,
  CONSTRAINT "complaint_subject_check" CHECK ("subject" in ('payment','listing','account','privacy','advertising','other')),
  CONSTRAINT "complaint_status_check" CHECK ("status" in ('open','answered','closed'))
);
CREATE INDEX IF NOT EXISTS "complaint_status_idx" ON "complaint" ("status", "created_at");
