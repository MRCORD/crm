CREATE TABLE "crm"."pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"category_id" uuid NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_stages_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "crm"."pipeline_template_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"category_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."pipeline_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "crm"."stage_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stage_categories_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "crm"."pipeline_stages" ADD CONSTRAINT "pipeline_stages_category_id_stage_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "crm"."stage_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."pipeline_template_stages" ADD CONSTRAINT "pipeline_template_stages_template_id_pipeline_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "crm"."pipeline_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pipeline_template_stages_template" ON "crm"."pipeline_template_stages" USING btree ("template_id");