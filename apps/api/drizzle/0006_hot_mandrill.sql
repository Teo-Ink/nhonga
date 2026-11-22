CREATE TABLE "vendor_subscription" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vendor_id" uuid NOT NULL,
	"plan_code" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"payment_method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_subscription_status_check" CHECK ("vendor_subscription"."status" in ('pending','active','failed'))
);
--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "pro_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_subscription" ADD CONSTRAINT "vendor_subscription_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_subscription_vendor_idx" ON "vendor_subscription" USING btree ("vendor_id");