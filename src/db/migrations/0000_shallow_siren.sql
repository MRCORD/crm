CREATE SCHEMA "system";
--> statement-breakpoint
CREATE SCHEMA "crm";
--> statement-breakpoint
CREATE SCHEMA "mcp";
--> statement-breakpoint
CREATE SCHEMA "retrieval";
--> statement-breakpoint
CREATE SCHEMA "ingest";
--> statement-breakpoint
CREATE TABLE "system"."api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "crm"."calendar_event_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_event_id" uuid NOT NULL,
	"company_id" uuid,
	"person_id" uuid,
	"opportunity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"meeting_url" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain_name" text,
	"industry" text,
	"employees_count" integer,
	"linkedin_url" text,
	"annual_revenue_amount_micros" numeric,
	"annual_revenue_currency" text DEFAULT 'USD',
	"address_street1" text,
	"address_city" text,
	"address_state" text,
	"address_postcode" text,
	"address_country" text,
	"address_lat" numeric(10, 7),
	"address_lng" numeric(10, 7),
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_vector" text,
	"position" double precision DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm"."custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_entity" text NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text NOT NULL,
	"options" jsonb,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_searchable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."custom_object_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_singular" text NOT NULL,
	"name_plural" text NOT NULL,
	"label_singular" text NOT NULL,
	"label_plural" text NOT NULL,
	"description" text,
	"icon" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_object_definitions_name_singular_unique" UNIQUE("name_singular"),
	CONSTRAINT "custom_object_definitions_name_plural_unique" UNIQUE("name_plural")
);
--> statement-breakpoint
CREATE TABLE "crm"."custom_object_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custom_object_id" uuid NOT NULL,
	"name" text NOT NULL,
	"company_id" uuid,
	"person_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_vector" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm"."note_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"company_id" uuid,
	"person_id" uuid,
	"opportunity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"point_of_contact_id" uuid,
	"name" text NOT NULL,
	"stage" text DEFAULT 'DISCOVERY' NOT NULL,
	"amount_micros" numeric DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"close_date" timestamp with time zone,
	"probability_percent" integer DEFAULT 20,
	"health_score" numeric,
	"loss_reason" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" double precision DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm"."people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"first_name" text,
	"last_name" text,
	"job_title" text,
	"email" text NOT NULL,
	"phone" text,
	"linkedin_url" text,
	"avatar_url" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_vector" text,
	"position" double precision DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm"."task_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"company_id" uuid,
	"person_id" uuid,
	"opportunity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignee_id" uuid,
	"title" text NOT NULL,
	"body" text,
	"due_at" timestamp with time zone,
	"status" text DEFAULT 'TODO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp"."mcp_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"tool_name" text NOT NULL,
	"action_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"proposed_text" text,
	"risk_tier" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"assigned_to_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp"."mcp_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"client_type" text DEFAULT 'STDIO' NOT NULL,
	"api_key_id" uuid,
	"allowed_tools" text[] DEFAULT '{"*"}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp"."mcp_tool_call_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"tool_name" text NOT NULL,
	"tool_input" jsonb NOT NULL,
	"tool_output" jsonb,
	"target_object" text,
	"target_record_id" uuid,
	"status" text NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retrieval"."interaction_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"external_call_id" text,
	"company_id" uuid,
	"person_id" uuid,
	"opportunity_id" uuid,
	"raw_transcript" text NOT NULL,
	"executive_summary" text,
	"action_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"objections_raised" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"competitors_mentioned" text[] DEFAULT '{}' NOT NULL,
	"sentiment_score" numeric(3, 2),
	"content_embedding" text,
	"summary_embedding" text,
	"search_vector" text,
	"happened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retrieval"."knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"embedding" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest"."event_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"entity_name" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest"."source_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"auth_credentials" jsonb NOT NULL,
	"sync_status" text DEFAULT 'ACTIVE' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest"."telemetry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_connection_id" uuid,
	"event_name" text NOT NULL,
	"associated_company_id" uuid,
	"associated_person_id" uuid,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system"."api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "system"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."calendar_event_targets" ADD CONSTRAINT "calendar_event_targets_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "crm"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."calendar_event_targets" ADD CONSTRAINT "calendar_event_targets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."calendar_event_targets" ADD CONSTRAINT "calendar_event_targets_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "crm"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."calendar_event_targets" ADD CONSTRAINT "calendar_event_targets_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "crm"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."custom_object_records" ADD CONSTRAINT "custom_object_records_custom_object_id_custom_object_definitions_id_fk" FOREIGN KEY ("custom_object_id") REFERENCES "crm"."custom_object_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."custom_object_records" ADD CONSTRAINT "custom_object_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."custom_object_records" ADD CONSTRAINT "custom_object_records_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "crm"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."note_targets" ADD CONSTRAINT "note_targets_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "crm"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."note_targets" ADD CONSTRAINT "note_targets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."note_targets" ADD CONSTRAINT "note_targets_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "crm"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."note_targets" ADD CONSTRAINT "note_targets_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "crm"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."opportunities" ADD CONSTRAINT "opportunities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."opportunities" ADD CONSTRAINT "opportunities_point_of_contact_id_people_id_fk" FOREIGN KEY ("point_of_contact_id") REFERENCES "crm"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."people" ADD CONSTRAINT "people_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."task_targets" ADD CONSTRAINT "task_targets_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "crm"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."task_targets" ADD CONSTRAINT "task_targets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."task_targets" ADD CONSTRAINT "task_targets_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "crm"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."task_targets" ADD CONSTRAINT "task_targets_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "crm"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "system"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp"."mcp_approvals" ADD CONSTRAINT "mcp_approvals_client_id_mcp_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "mcp"."mcp_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp"."mcp_approvals" ADD CONSTRAINT "mcp_approvals_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "system"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp"."mcp_clients" ADD CONSTRAINT "mcp_clients_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "system"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp"."mcp_tool_call_receipts" ADD CONSTRAINT "mcp_tool_call_receipts_client_id_mcp_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "mcp"."mcp_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval"."interaction_transcripts" ADD CONSTRAINT "interaction_transcripts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval"."interaction_transcripts" ADD CONSTRAINT "interaction_transcripts_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "crm"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval"."interaction_transcripts" ADD CONSTRAINT "interaction_transcripts_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "crm"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest"."telemetry_events" ADD CONSTRAINT "telemetry_events_source_connection_id_source_connections_id_fk" FOREIGN KEY ("source_connection_id") REFERENCES "ingest"."source_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest"."telemetry_events" ADD CONSTRAINT "telemetry_events_associated_company_id_companies_id_fk" FOREIGN KEY ("associated_company_id") REFERENCES "crm"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest"."telemetry_events" ADD CONSTRAINT "telemetry_events_associated_person_id_people_id_fk" FOREIGN KEY ("associated_person_id") REFERENCES "crm"."people"("id") ON DELETE set null ON UPDATE no action;