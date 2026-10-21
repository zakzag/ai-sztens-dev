-- AIS-39: the `platform` schema is created by infra/postgres/init/02-schemas.sh on
-- every live volume, so the generated `CREATE SCHEMA "platform"` is relaxed to
-- `IF NOT EXISTS` (same hand-fix as 0000_pretty_bromley.sql).
CREATE SCHEMA IF NOT EXISTS "platform";
--> statement-breakpoint
CREATE TABLE "platform"."api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"identifier" text NOT NULL,
	"description" text,
	"api_key" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_identifier_key" UNIQUE("identifier")
);
