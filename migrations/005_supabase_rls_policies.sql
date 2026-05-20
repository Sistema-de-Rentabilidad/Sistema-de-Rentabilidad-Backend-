-- Security hardening for Supabase Data API access.
--
-- The Express backend uses its own JWT and connects directly to PostgreSQL
-- through DATABASE_URL as the postgres role. That role has BYPASSRLS, so these
-- policies intentionally protect direct Supabase Data API access by anon and
-- authenticated without changing the current backend behavior.
--
-- Reversible rollback outline:
--   drop policy if exists data_api_no_direct_access on public.<table>;
--   grant the required table/schema privileges back to anon/authenticated only
--   if the frontend is intentionally changed to use Supabase Data API directly.

revoke usage on schema public from anon, authenticated, public;
revoke all privileges on all tables in schema public from anon, authenticated, public;
revoke all privileges on all sequences in schema public from anon, authenticated, public;

alter default privileges in schema public
  revoke all on tables from anon, authenticated, public;

alter default privileges in schema public
  revoke all on sequences from anon, authenticated, public;

do $$
declare
  target_table text;
  protected_tables text[] := array[
    'usuario',
    'empresa',
    'proyecto',
    'servicio',
    'registro_horas',
    'marcaje',
    'nota',
    'fase',
    'historial_sueldo',
    'proyecto_empleado',
    'fase_empleado',
    'proyecto_lider'
  ];
begin
  foreach target_table in array protected_tables loop
    if to_regclass(format('public.%I', target_table)) is not null then
      execute format(
        'alter table public.%I enable row level security',
        target_table
      );

      execute format(
        'drop policy if exists data_api_no_direct_access on public.%I',
        target_table
      );

      execute format(
        'create policy data_api_no_direct_access on public.%I
           as restrictive
           for all
           to anon, authenticated
           using (false)
           with check (false)',
        target_table
      );

      execute format(
        'comment on policy data_api_no_direct_access on public.%I is %L',
        target_table,
        'Blocks direct Supabase Data API access for anon/authenticated. Access must go through the Express backend.'
      );
    end if;
  end loop;
end $$;
