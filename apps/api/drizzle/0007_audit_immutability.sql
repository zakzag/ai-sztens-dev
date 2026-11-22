-- AIS-177 — `audit.audit_logs` is append-only.
--
-- WHY THIS FILE IS HAND-WRITTEN
-- -----------------------------
-- `drizzle-kit generate` only diffs the schema-as-code: it emits tables,
-- columns and indexes, but it cannot emit a PL/pgSQL function, a trigger or a
-- GRANT. This file was produced once with
-- `db:generate --custom --name=audit_immutability` and is maintained by hand.
-- NEVER delete or regenerate it: the ledger has no other protection, and the
-- e2e spec `apps/api/test/audit-immutability.e2e-spec.ts` fails without it.
--
-- WHY THE GRANTS ALONE ARE NOT ENOUGH
-- -----------------------------------
-- Migrations run as the application role, which OWNS `audit.audit_logs`. An
-- owner keeps UPDATE / DELETE regardless of what is granted or revoked on the
-- table, so the triggers below — not the GRANTs — are the actual enforcement.
-- The GRANTs stay as documented intent and as a guard for every other role.
--
-- SELECT is granted on purpose: `GET /:id/audit-logs` (AIS-178, the Napló tab
-- of AIS-181) reads this table. "Only INSERT" from the ticket cannot be true
-- and still let the admin UI display the log; the invariant that matters is
-- "no rewrite, no erasure", and that is what the triggers enforce.
--
-- `TO CURRENT_USER` instead of a literal role name: the app role is configured
-- per environment (AISZTENS_DB_USER), and a hard-coded `aisztens` would break
-- the moment an environment renames it.

CREATE OR REPLACE FUNCTION audit.reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'audit.audit_logs is append-only: % is not allowed (AIS-177)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;--> statement-breakpoint

CREATE TRIGGER audit_logs_append_only_row
  BEFORE UPDATE OR DELETE ON audit.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit.reject_audit_mutation();--> statement-breakpoint

-- TRUNCATE is not a row trigger: it needs its own statement-level trigger, or
-- the whole ledger could be emptied with a single statement that fires no
-- BEFORE UPDATE / DELETE at all.
CREATE TRIGGER audit_logs_append_only_statement
  BEFORE TRUNCATE ON audit.audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION audit.reject_audit_mutation();--> statement-breakpoint

GRANT SELECT, INSERT ON audit.audit_logs TO CURRENT_USER;--> statement-breakpoint

REVOKE ALL ON audit.audit_logs FROM PUBLIC;
