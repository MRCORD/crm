CREATE TABLE "crm"."sequence_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"sequence_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"company_id" uuid,
	"current_step" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_step_due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_step_executed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."sequence_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"delay_days" integer DEFAULT 0 NOT NULL,
	"channel" text NOT NULL,
	"template_subject" text,
	"template_body" text,
	"prompt_instructions" text,
	"exit_on_reply" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"owner_id" text,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm"."sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "crm"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "crm"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."sequence_steps" ADD CONSTRAINT "sequence_steps_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "crm"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."sequences" ADD CONSTRAINT "sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."sequences" ADD CONSTRAINT "sequences_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "system"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sequence_enrollments_status" ON "crm"."sequence_enrollments" USING btree ("status","next_step_due_at");--> statement-breakpoint
CREATE INDEX "idx_sequence_enrollments_person" ON "crm"."sequence_enrollments" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_sequence_enrollments_seq" ON "crm"."sequence_enrollments" USING btree ("sequence_id");--> statement-breakpoint
CREATE INDEX "idx_sequence_steps_seq" ON "crm"."sequence_steps" USING btree ("sequence_id","step_order");--> statement-breakpoint
CREATE INDEX "idx_sequences_org" ON "crm"."sequences" USING btree ("organization_id");