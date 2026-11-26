-- AIS-177: the `activity` feed and the `audit` ledger.
--
-- HAND-EDITED (one line, deliberately): the generator emitted plain
-- `CREATE SCHEMA`, which fails on an existing volume where
-- `infra/postgres/init/02-schemas.sh` already created the schema. The AIS-18
-- migration needed the same correction, and `db:check` stays green because the
-- statement is still the same DDL.
CREATE SCHEMA IF NOT EXISTS "activity";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "audit";
--> statement-breakpoint
CREATE TYPE "activity"."activity_type" AS ENUM('note', 'call', 'email', 'meeting', 'status_change', 'system');--> statement-breakpoint
CREATE TYPE "audit"."audit_operation" AS ENUM('insert', 'update', 'delete', 'soft_delete');--> statement-breakpoint
CREATE TYPE "audit"."audit_source" AS ENUM('admin_api', 'web', 'worker', 'cron');--> statement-breakpoint
CREATE TYPE "activity"."author_type" AS ENUM('operator', 'customer_user', 'system', 'api_key');--> statement-breakpoint
CREATE TABLE "activity"."activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" "activity"."activity_type" NOT NULL,
	"body" text NOT NULL,
	"author_type" "activity"."author_type" NOT NULL,
	"operator_id" uuid,
	"customer_user_id" uuid,
	"author_name" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "activities_author_reference_check" CHECK ((
            ("activity"."activities"."author_type" = 'system'
              AND "activity"."activities"."operator_id" IS NULL AND "activity"."activities"."customer_user_id" IS NULL)
         OR ("activity"."activities"."author_type" = 'operator'
              AND "activity"."activities"."operator_id" IS NOT NULL AND "activity"."activities"."customer_user_id" IS NULL)
         OR ("activity"."activities"."author_type" = 'customer_user'
              AND "activity"."activities"."operator_id" IS NULL AND "activity"."activities"."customer_user_id" IS NOT NULL)
         OR ("activity"."activities"."author_type" = 'api_key'
              AND "activity"."activities"."operator_id" IS NULL AND "activity"."activities"."customer_user_id" IS NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "audit"."audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit"."audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"customer_id" uuid,
	"table_name" text NOT NULL,
	"record_id" uuid,
	"operation" "audit"."audit_operation" NOT NULL,
	"before_data" jsonb,
	"after_data" jsonb,
	"actor_type" "activity"."author_type" NOT NULL,
	"actor_id" uuid,
	"actor_name" text NOT NULL,
	"occurred_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"request_id" text,
	"source" "audit"."audit_source"
);
--> statement-breakpoint
ALTER TABLE "activity"."activities" ADD CONSTRAINT "activities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customer"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity"."activities" ADD CONSTRAINT "activities_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "iam"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity"."activities" ADD CONSTRAINT "activities_customer_user_id_customer_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "iam"."customer_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_customer_created_idx" ON "activity"."activities" USING btree ("customer_id","created_at" DESC NULLS LAST) WHERE "activity"."activities"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "audit_logs_customer_occurred_idx" ON "audit"."audit_logs" USING btree ("customer_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_table_record_idx" ON "audit"."audit_logs" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "audit_logs_request_id_idx" ON "audit"."audit_logs" USING btree ("request_id");