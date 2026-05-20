-- Follow-up to 005_supabase_rls_policies.sql.
-- Applied separately in Supabase because the initial 005 deployment revoked
-- anon/authenticated schema usage but the PUBLIC schema grant still allowed
-- inherited USAGE. This statement is idempotent and keeps local migrations
-- aligned with the applied Supabase migration history.

revoke usage on schema public from anon, authenticated, public;
