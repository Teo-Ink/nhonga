CREATE TABLE IF NOT EXISTS "address" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text,
	"recipient_name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"province_code" text NOT NULL,
	"district_id" uuid NOT NULL,
	"bairro" text NOT NULL,
	"quarteirao" text,
	"house_number" text,
	"landmark" text NOT NULL,
	"notes" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone_e164" text NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"email" text,
	"email_verified_at" timestamp with time zone,
	"display_name" text NOT NULL,
	"locale" text DEFAULT 'pt-MZ' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "app_user_locale_check" CHECK ("app_user"."locale" in ('pt-MZ','en')),
	CONSTRAINT "app_user_status_check" CHECK ("app_user"."status" in ('active','suspended','deleted')),
	CONSTRAINT "app_user_phone_format_check" CHECK ("app_user"."phone_e164" ~ '^\+258[8][2-7][0-9]{7}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "district" (
	"id" uuid PRIMARY KEY NOT NULL,
	"province_code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "otp_challenge" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone_e164" text NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"max_attempts" smallint DEFAULT 5 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otp_challenge_purpose_check" CHECK ("otp_challenge"."purpose" in ('login','verify_phone','payout_change'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "province" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_token" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" uuid NOT NULL,
	"device_label" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commission_rule" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid,
	"vendor_id" uuid,
	"percentage_bps" integer NOT NULL,
	"fixed_fee_cents" bigint DEFAULT 0 NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_rule_bps_check" CHECK ("commission_rule"."percentage_bps" >= 0 and "commission_rule"."percentage_bps" <= 10000),
	CONSTRAINT "commission_rule_fee_check" CHECK ("commission_rule"."fixed_fee_cents" >= 0),
	CONSTRAINT "commission_rule_window_check" CHECK ("commission_rule"."effective_to" is null or "commission_rule"."effective_to" > "commission_rule"."effective_from")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_document" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vendor_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"s3_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kyc_document_type_check" CHECK ("kyc_document"."doc_type" in ('id_front','id_back','selfie','nuit','alvara','bank_proof')),
	CONSTRAINT "kyc_document_status_check" CHECK ("kyc_document"."status" in ('pending','accepted','rejected'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payout_account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vendor_id" uuid NOT NULL,
	"method" text NOT NULL,
	"holder_name" text NOT NULL,
	"account_encrypted" text NOT NULL,
	"bank_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"verified_at" timestamp with time zone,
	"usable_from" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_account_method_check" CHECK ("payout_account"."method" in ('mpesa','emola','mkesh','bank'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"vendor_type" text NOT NULL,
	"nuit_encrypted" text,
	"district_id" uuid,
	"status" text DEFAULT 'pending_kyc' NOT NULL,
	"kyc_reviewed_by" uuid,
	"kyc_reviewed_at" timestamp with time zone,
	"kyc_reason" text,
	"rating_avg" numeric(2, 1),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"median_response_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_type_check" CHECK ("vendor"."vendor_type" in ('individual','company')),
	CONSTRAINT "vendor_status_check" CHECK ("vendor"."status" in ('pending_kyc','info_requested','active','suspended','rejected','closed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vendor_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_user_role_check" CHECK ("vendor_user"."role" in ('owner','manager','staff'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category" (
	"id" uuid PRIMARY KEY NOT NULL,
	"parent_id" uuid,
	"slug" text NOT NULL,
	"name_pt" text NOT NULL,
	"name_en" text NOT NULL,
	"level" smallint NOT NULL,
	"icon_key" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "category_level_check" CHECK ("category"."level" between 1 and 3),
	CONSTRAINT "category_root_check" CHECK (("category"."level" = 1 and "category"."parent_id" is null) or ("category"."level" > 1 and "category"."parent_id" is not null))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category_attribute" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label_pt" text NOT NULL,
	"label_en" text NOT NULL,
	"data_type" text NOT NULL,
	"options" jsonb,
	"is_variant_axis" boolean DEFAULT false NOT NULL,
	"is_filterable" boolean DEFAULT true NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "category_attribute_type_check" CHECK ("category_attribute"."data_type" in ('text','number','boolean','enum'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vendor_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title_pt" text NOT NULL,
	"title_en" text,
	"description_pt" text,
	"description_en" text,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"weight_grams" integer,
	"rating_avg" numeric(2, 1),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_status_check" CHECK ("product"."status" in ('draft','pending_review','active','suspended','archived')),
	CONSTRAINT "product_weight_check" CHECK ("product"."weight_grams" is null or "product"."weight_grams" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_image" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"lqip" text,
	"alt_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_variant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_cents" bigint NOT NULL,
	"compare_at_cents" bigint,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "product_variant_price_check" CHECK ("product_variant"."price_cents" >= 0),
	CONSTRAINT "product_variant_compare_check" CHECK ("product_variant"."compare_at_cents" is null or "product_variant"."compare_at_cents" >= 0),
	CONSTRAINT "product_variant_stock_check" CHECK ("product_variant"."stock_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger" (
	"id" uuid PRIMARY KEY NOT NULL,
	"variant_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"reference_id" uuid,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_ledger_reason_check" CHECK ("stock_ledger"."reason" in ('vendor_adjust','order_reserve','order_release','order_cancel','return','recount','import')),
	CONSTRAINT "stock_ledger_delta_check" CHECK ("stock_ledger"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"user_id" uuid NOT NULL,
	"address_id" uuid,
	"address_snapshot" jsonb NOT NULL,
	"items_total_cents" bigint NOT NULL,
	"shipping_total_cents" bigint NOT NULL,
	"payment_fee_cents" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"grand_total_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'MZN' NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_total_check" CHECK ("order"."items_total_cents" >= 0),
	CONSTRAINT "order_shipping_total_check" CHECK ("order"."shipping_total_cents" >= 0),
	CONSTRAINT "order_payment_fee_check" CHECK ("order"."payment_fee_cents" >= 0),
	CONSTRAINT "order_discount_check" CHECK ("order"."discount_cents" >= 0),
	CONSTRAINT "order_grand_total_check" CHECK ("order"."grand_total_cents" >= 0),
	CONSTRAINT "order_totals_balance_check" CHECK ("order"."grand_total_cents" = "order"."items_total_cents" + "order"."shipping_total_cents" + "order"."payment_fee_cents" - "order"."discount_cents")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sub_order_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_event_actor_check" CHECK ("order_event"."actor_type" in ('buyer','vendor','admin','system'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sub_order_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"product_snapshot" jsonb NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_cents" bigint NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "order_item_unit_price_check" CHECK ("order_item"."unit_price_cents" >= 0),
	CONSTRAINT "order_item_quantity_check" CHECK ("order_item"."quantity" > 0),
	CONSTRAINT "order_item_line_total_check" CHECK ("order_item"."line_total_cents" = "order_item"."unit_price_cents" * "order_item"."quantity")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"msisdn_encrypted" text,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'MZN' NOT NULL,
	"status" text DEFAULT 'initiated' NOT NULL,
	"provider_tx_id" text,
	"provider_ref" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"failure_code" text,
	"failure_message" text,
	"attempt_number" smallint DEFAULT 1 NOT NULL,
	"initiated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"reconcile_until" timestamp with time zone,
	CONSTRAINT "payment_provider_check" CHECK ("payment"."provider" in ('mpesa','emola','mkesh','cod')),
	CONSTRAINT "payment_status_check" CHECK ("payment"."status" in ('initiated','awaiting_user','paid','failed','expired','refund_pending','refunded','refund_failed')),
	CONSTRAINT "payment_amount_check" CHECK ("payment"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid,
	"provider" text NOT NULL,
	"provider_event_id" text,
	"direction" text NOT NULL,
	"event_type" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"signature_valid" boolean,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_event_direction_check" CHECK ("payment_event"."direction" in ('outbound','inbound'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refund" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"sub_order_id" uuid,
	"amount_cents" bigint NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_refund_id" text,
	"idempotency_key" text NOT NULL,
	"requested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "refund_amount_check" CHECK ("refund"."amount_cents" > 0),
	CONSTRAINT "refund_status_check" CHECK ("refund"."status" in ('pending','succeeded','failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settlement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sub_order_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"batch_id" uuid,
	"gross_cents" bigint NOT NULL,
	"commission_cents" bigint NOT NULL,
	"fixed_fee_cents" bigint NOT NULL,
	"adjustment_cents" bigint DEFAULT 0 NOT NULL,
	"net_cents" bigint NOT NULL,
	"fees_clamped" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"held_reason" text,
	"commission_rule_id" uuid,
	"eligible_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	CONSTRAINT "settlement_status_check" CHECK ("settlement"."status" in ('pending','eligible','held','batched','paid','failed')),
	CONSTRAINT "settlement_balance_check" CHECK ("settlement"."net_cents" = "settlement"."gross_cents" - "settlement"."commission_cents" - "settlement"."fixed_fee_cents" + "settlement"."adjustment_cents")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settlement_batch" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vendor_id" uuid NOT NULL,
	"total_cents" bigint NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"second_approved_by" uuid,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"provider_tx_id" text,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_batch_status_check" CHECK ("settlement_batch"."status" in ('draft','awaiting_approval','approved','paid','failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sub_order" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"sub_order_number" text NOT NULL,
	"status" text DEFAULT 'awaiting_payment' NOT NULL,
	"items_total_cents" bigint NOT NULL,
	"shipping_cents" bigint DEFAULT 0 NOT NULL,
	"delivery_method" text DEFAULT 'marketplace' NOT NULL,
	"tracking_code" text,
	"estimated_min_days" smallint,
	"estimated_max_days" smallint,
	"accepted_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"auto_complete_at" timestamp with time zone,
	"respond_by_at" timestamp with time zone,
	CONSTRAINT "sub_order_status_check" CHECK ("sub_order"."status" in ('awaiting_payment','confirmed','preparing','shipped','in_transit','delivered','completed','cancelled','disputed','refunded')),
	CONSTRAINT "sub_order_delivery_method_check" CHECK ("sub_order"."delivery_method" in ('marketplace','vendor','pickup')),
	CONSTRAINT "sub_order_items_total_check" CHECK ("sub_order"."items_total_cents" >= 0),
	CONSTRAINT "sub_order_shipping_check" CHECK ("sub_order"."shipping_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_actor_type_check" CHECK ("audit_log"."actor_type" in ('user','vendor','admin','system'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_key" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"endpoint" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_key_status_check" CHECK ("idempotency_key"."status" in ('in_progress','completed','failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"sequence" integer NOT NULL,
	"published_at" timestamp with time zone,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "address" ADD CONSTRAINT "address_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "address" ADD CONSTRAINT "address_province_code_province_code_fk" FOREIGN KEY ("province_code") REFERENCES "public"."province"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "address" ADD CONSTRAINT "address_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "district" ADD CONSTRAINT "district_province_code_province_code_fk" FOREIGN KEY ("province_code") REFERENCES "public"."province"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commission_rule" ADD CONSTRAINT "commission_rule_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_document" ADD CONSTRAINT "kyc_document_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payout_account" ADD CONSTRAINT "payout_account_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor" ADD CONSTRAINT "vendor_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_user" ADD CONSTRAINT "vendor_user_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_user" ADD CONSTRAINT "vendor_user_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "category_attribute" ADD CONSTRAINT "category_attribute_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product" ADD CONSTRAINT "product_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order" ADD CONSTRAINT "order_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order" ADD CONSTRAINT "order_address_id_address_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."address"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_event" ADD CONSTRAINT "order_event_sub_order_id_sub_order_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_item" ADD CONSTRAINT "order_item_sub_order_id_sub_order_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_item" ADD CONSTRAINT "order_item_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refund" ADD CONSTRAINT "refund_sub_order_id_sub_order_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "settlement" ADD CONSTRAINT "settlement_sub_order_id_sub_order_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "settlement" ADD CONSTRAINT "settlement_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "settlement" ADD CONSTRAINT "settlement_batch_id_settlement_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."settlement_batch"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "settlement" ADD CONSTRAINT "settlement_commission_rule_id_commission_rule_id_fk" FOREIGN KEY ("commission_rule_id") REFERENCES "public"."commission_rule"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "settlement_batch" ADD CONSTRAINT "settlement_batch_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sub_order" ADD CONSTRAINT "sub_order_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sub_order" ADD CONSTRAINT "sub_order_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "address_user_idx" ON "address" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "address_district_idx" ON "address" USING btree ("district_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "address_user_default_key" ON "address" USING btree ("user_id") WHERE "address"."is_default" and "address"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "app_user_phone_key" ON "app_user" USING btree ("phone_e164");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "app_user_email_key" ON "app_user" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_user_active_phone_idx" ON "app_user" USING btree ("phone_e164") WHERE "app_user"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "district_province_idx" ON "district" USING btree ("province_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "district_province_name_key" ON "district" USING btree ("province_code","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otp_challenge_phone_idx" ON "otp_challenge" USING btree ("phone_e164","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_token_hash_key" ON "refresh_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_token_family_idx" ON "refresh_token" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_token_user_idx" ON "refresh_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commission_rule_lookup_idx" ON "commission_rule" USING btree ("category_id","vendor_id","effective_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_document_vendor_idx" ON "kyc_document" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_account_vendor_idx" ON "payout_account" USING btree ("vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payout_account_active_key" ON "payout_account" USING btree ("vendor_id") WHERE "payout_account"."is_active";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_slug_key" ON "vendor" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_status_idx" ON "vendor" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_user_key" ON "vendor_user" USING btree ("vendor_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_user_user_idx" ON "vendor_user" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "category_slug_key" ON "category" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_parent_idx" ON "category" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "category_attribute_key" ON "category_attribute" USING btree ("category_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_slug_key" ON "product" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_vendor_status_idx" ON "product" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_category_active_idx" ON "product" USING btree ("category_id") WHERE "product"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_attributes_gin" ON "product" USING gin ("attributes");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_image_product_idx" ON "product_image" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_variant_sku_key" ON "product_variant" USING btree ("product_id","sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_variant_product_idx" ON "product_variant" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_ledger_variant_idx" ON "stock_ledger" USING btree ("variant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_ledger_reference_idx" ON "stock_ledger" USING btree ("reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_number_key" ON "order" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_user_idx" ON "order" USING btree ("user_id","placed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_event_sub_order_idx" ON "order_event" USING btree ("sub_order_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_item_sub_order_idx" ON "order_item" USING btree ("sub_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_item_variant_idx" ON "order_item" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_idempotency_key" ON "payment" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_tx_key" ON "payment" USING btree ("provider","provider_tx_id") WHERE "payment"."provider_tx_id" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_order_idx" ON "payment" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_awaiting_idx" ON "payment" USING btree ("expires_at") WHERE "payment"."status" in ('initiated','awaiting_user');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reconcile_idx" ON "payment" USING btree ("reconcile_until") WHERE "payment"."status" = 'expired';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_event_provider_event_key" ON "payment_event" USING btree ("provider","provider_event_id") WHERE "payment_event"."provider_event_id" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_event_payment_idx" ON "payment_event" USING btree ("payment_id","received_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_event_unprocessed_idx" ON "payment_event" USING btree ("received_at") WHERE "payment_event"."processed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "refund_idempotency_key" ON "refund" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refund_payment_idx" ON "refund" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "settlement_sub_order_key" ON "settlement" USING btree ("sub_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlement_vendor_status_idx" ON "settlement" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlement_batch_idx" ON "settlement" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlement_batch_vendor_idx" ON "settlement_batch" USING btree ("vendor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sub_order_number_key" ON "sub_order" USING btree ("sub_order_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sub_order_order_vendor_key" ON "sub_order" USING btree ("order_id","vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sub_order_vendor_status_idx" ON "sub_order" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sub_order_auto_complete_idx" ON "sub_order" USING btree ("auto_complete_at") WHERE "sub_order"."status" = 'delivered';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sub_order_respond_by_idx" ON "sub_order" USING btree ("respond_by_at") WHERE "sub_order"."status" = 'confirmed';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_action_idx" ON "audit_log" USING btree ("action","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idempotency_key_expiry_idx" ON "idempotency_key" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idempotency_key_user_idx" ON "idempotency_key" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_unpublished_idx" ON "outbox" USING btree ("created_at") WHERE "outbox"."published_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_aggregate_idx" ON "outbox" USING btree ("aggregate_type","aggregate_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "outbox_aggregate_sequence_key" ON "outbox" USING btree ("aggregate_type","aggregate_id","sequence");