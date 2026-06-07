-- Backend readiness constraints for Testiny secondary cases.
-- Non-destructive: fail fast if current data would violate the new guarantees.

do $$
begin
  if exists (
    select 1
    from public.fase
    where is_active = true
    group by id_proyecto, lower(btrim(nombre))
    having count(*) > 1
  ) then
    raise exception 'No se puede crear unique_fase_proyecto_nombre_activo: existen fases activas duplicadas por proyecto/nombre';
  end if;
end $$;

create unique index if not exists unique_fase_proyecto_nombre_activo
on public.fase (id_proyecto, lower(btrim(nombre)))
where is_active = true;

do $$
begin
  if exists (
    select 1
    from public.marcaje
    group by id_usuario, fecha
    having count(*) > 1
  ) then
    raise exception 'No se puede crear unique_marcaje_usuario_fecha: existen marcajes duplicados por usuario/fecha';
  end if;
end $$;

create unique index if not exists unique_marcaje_usuario_fecha
on public.marcaje (id_usuario, fecha);

do $$
begin
  if exists (
    select 1
    from public.registro_horas rh
    left join public.proyecto p
      on p.id_proyecto = rh.id_proyecto
    where p.id_proyecto is null
  ) then
    raise exception 'No se puede crear fk_rh_proyecto: existen registros de horas sin proyecto valido';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_rh_proyecto'
      and conrelid = 'public.registro_horas'::regclass
  ) then
    alter table public.registro_horas
      add constraint fk_rh_proyecto
      foreign key (id_proyecto)
      references public.proyecto(id_proyecto)
      on delete restrict;
  end if;
end $$;
