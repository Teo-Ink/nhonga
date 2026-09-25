CREATE TABLE "product_promotion" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"plan_code" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"payment_method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_promotion_status_check" CHECK ("product_promotion"."status" in ('pending', 'active', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "promotion_plan" (
	"code" text PRIMARY KEY NOT NULL,
	"name_pt" text NOT NULL,
	"name_en" text NOT NULL,
	"kind" text NOT NULL,
	"price_cents" bigint NOT NULL,
	"duration_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "promotion_plan_kind_check" CHECK ("promotion_plan"."kind" in ('feature', 'bump')),
	CONSTRAINT "promotion_plan_price_check" CHECK ("promotion_plan"."price_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "featured_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "bumped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_promotion" ADD CONSTRAINT "product_promotion_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_promotion_product_idx" ON "product_promotion" USING btree ("product_id");