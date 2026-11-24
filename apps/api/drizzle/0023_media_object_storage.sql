-- P1-03: listing photos move to S3. New uploads store only the object key;
-- older rows keep their base64 bytes until scripts/migrate-media-to-s3.mjs
-- moves them. Every row has one or the other.
ALTER TABLE "media_asset" ADD COLUMN IF NOT EXISTS "storage_key" text;
ALTER TABLE "media_asset" ALTER COLUMN "data_base64" DROP NOT NULL;
ALTER TABLE "media_asset" DROP CONSTRAINT IF EXISTS "media_asset_bytes_or_key_check";
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_bytes_or_key_check"
  CHECK ("data_base64" IS NOT NULL OR "storage_key" IS NOT NULL);
