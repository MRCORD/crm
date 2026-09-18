CREATE TABLE "crm"."opportunity_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_micros" numeric NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"total_price_micros" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"sku" text,
	"description" text,
	"default_price_micros" numeric NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "crm"."quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"opportunity_id" uuid NOT NULL,
	"quote_number" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"total_amount_micros" numeric NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"expires_at" timestamp with time zone,
	"notes" text,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm"."opportunity_line_items" ADD CONSTRAINT "opportunity_line_items_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "crm"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."opportunity_line_items" ADD CONSTRAINT "opportunity_line_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "crm"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."products" ADD CONSTRAINT "products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotes" ADD CONSTRAINT "quotes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotes" ADD CONSTRAINT "quotes_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "crm"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_line_items_opp" ON "crm"."opportunity_line_items" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "idx_line_items_prod" ON "crm"."opportunity_line_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_products_sku" ON "crm"."products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_products_org" ON "crm"."products" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_opp" ON "crm"."quotes" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_number" ON "crm"."quotes" USING btree ("quote_number");--> statement-breakpoint
CREATE INDEX "idx_quotes_org" ON "crm"."quotes" USING btree ("organization_id");