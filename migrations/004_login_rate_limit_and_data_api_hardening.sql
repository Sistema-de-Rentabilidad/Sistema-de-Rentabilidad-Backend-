-- Additive security migration for the Express backend.
-- It does not change application data or route contracts.

create schema if not exists private;

create table if not exists private.login_rate_limits (
  key text primary key,
  ip inet,
  email_hash text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  reset_at timestamptz not null,
  first_attempt_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists login_rate_limits_reset_at_idx
  on private.login_rate_limits (reset_at);

create index if not exists login_rate_limits_ip_updated_at_idx
  on private.login_rate_limits (ip, updated_at desc);

revoke all on schema private from anon, authenticated, public;
revoke all on all tables in schema private from anon, authenticated, public;
revoke all on all sequences in schema private from anon, authenticated, public;

-- The backend uses a direct PostgreSQL connection and its own JWT, not
-- Supabase Auth. These grants are unnecessary for the Supabase Data API.
-- RLS is already enabled on these public tables; revoking API-role grants keeps
-- accidental future policies or grants from exposing data directly.
revoke all privileges on table public.empresa from anon, authenticated;
revoke all privileges on table public.usuario from anon, authenticated;
revoke all privileges on table public.historial_sueldo from anon, authenticated;
revoke all privileges on table public.servicio from anon, authenticated;
revoke all privileges on table public.proyecto from anon, authenticated;
revoke all privileges on table public.proyecto_empleado from anon, authenticated;
revoke all privileges on table public.registro_horas from anon, authenticated;
revoke all privileges on table public.nota from anon, authenticated;
revoke all privileges on table public.fase from anon, authenticated;
revoke all privileges on table public.marcaje from anon, authenticated;
revoke all privileges on table public.fase_empleado from anon, authenticated;

revoke all privileges on all sequences in schema public from anon, authenticated;
