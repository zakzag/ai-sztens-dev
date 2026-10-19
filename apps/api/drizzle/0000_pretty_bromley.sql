CREATE SCHEMA IF NOT EXISTS "callback";
--> statement-breakpoint
CREATE TYPE "callback"."call_status" AS ENUM('queued', 'dialing', 'ringing', 'in-progress', 'completed', 'failed', 'no_answer', 'busy', 'actions-executing', 'done');--> statement-breakpoint
CREATE TABLE "callback"."callback_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(254) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"reason" varchar(1000) NOT NULL,
	"status" "callback"."call_status" DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
