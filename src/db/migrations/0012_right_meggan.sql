CREATE TABLE "crm"."brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"website" text,
	"logo_url" text,
	"color" text DEFAULT 'gray' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "crm"."opportunities" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "crm"."products" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "crm"."sequences" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "crm"."views" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "crm"."opportunities" ADD CONSTRAINT "opportunities_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "crm"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "crm"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."sequences" ADD CONSTRAINT "sequences_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "crm"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."views" ADD CONSTRAINT "views_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "crm"."brands"("id") ON DELETE set null ON UPDATE no action;