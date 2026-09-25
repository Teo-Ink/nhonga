ALTER TABLE "vendor" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "show_whatsapp" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "show_phone" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "contact_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "share_count" integer DEFAULT 0 NOT NULL;