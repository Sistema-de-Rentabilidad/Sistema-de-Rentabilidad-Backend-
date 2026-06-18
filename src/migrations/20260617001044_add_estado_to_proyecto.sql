BEGIN;

ALTER TABLE public.proyecto
  ADD COLUMN IF NOT EXISTS estado varchar(20);

UPDATE public.proyecto
SET estado = CASE
  WHEN fecha_fin_real IS NOT NULL THEN 'Finalizado'
  ELSE 'Ejecución'
END
WHERE estado IS NULL;

ALTER TABLE public.proyecto
  ALTER COLUMN estado SET DEFAULT 'Cotizado',
  ALTER COLUMN estado SET NOT NULL;

ALTER TABLE public.proyecto
  DROP CONSTRAINT IF EXISTS proyecto_estado_check;

ALTER TABLE public.proyecto
  ADD CONSTRAINT proyecto_estado_check
  CHECK (estado IN ('Cotizado', 'Aprobado', 'Ejecución', 'Desestimado', 'Finalizado'));

COMMIT;
