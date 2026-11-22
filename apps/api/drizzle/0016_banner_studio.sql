-- AI Banner Studio: generated promotional banners for listings.
CREATE TABLE IF NOT EXISTS "listing_banner" (
  "id" uuid PRIMARY KEY NOT NULL,
  "product_id" uuid NOT NULL,
  "vendor_id" uuid NOT NULL,
  "preset" text NOT NULL,
  "ratio" text NOT NULL,
  "spec" jsonb NOT NULL,
  "svg" text NOT NULL,
  "watermarked" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "listing_banner" ADD CONSTRAINT "listing_banner_product_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "listing_banner" ADD CONSTRAINT "listing_banner_vendor_id_fk"
    FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "listing_banner_vendor_idx" ON "listing_banner" ("vendor_id","created_at");
CREATE INDEX IF NOT EXISTS "listing_banner_product_idx" ON "listing_banner" ("product_id");

-- Applied banner reference on the listing (FK declared here to avoid an ORM
-- schema import cycle).
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "banner_id" uuid;
DO $$ BEGIN
  ALTER TABLE "product" ADD CONSTRAINT "product_banner_id_fk"
    FOREIGN KEY ("banner_id") REFERENCES "listing_banner"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
