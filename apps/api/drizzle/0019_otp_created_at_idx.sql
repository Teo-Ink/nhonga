-- SEC-02: the global hourly limit on login codes counts recent challenges across
-- all numbers; this index keeps that count cheap.
CREATE INDEX IF NOT EXISTS "otp_challenge_created_idx" ON "otp_challenge" ("created_at" DESC);
