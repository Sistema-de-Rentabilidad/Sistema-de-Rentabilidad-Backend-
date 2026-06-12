# Evidencia NF-13 - Consumo de CPU y memoria

## Datos de ejecucion

- Fecha:
- Hora inicio:
- Hora fin:
- Zona horaria:
- Rama del repositorio:
- URL objetivo (`API_BASE_URL`):
- Responsable:

## Configuracion de carga

- Herramienta:
- Version de k6:
- Warm-up:
- Ramp-up:
- Sustained load:
- Cool-down:
- VUs maximos:
- Timeout por request:
- Sleep entre requests:

## Variables usadas

- `NF13_PROJECT_ID`:
- `NF13_FASE_ID`:
- `NF13_NOTA_ID`:
- `NF13_PROFILE`:
- `NF13_ENDPOINTS`:
- Metodo de autenticacion usado: login / cookie temporal

No registrar passwords, tokens ni cookies en esta evidencia.

## Endpoints ejecutados

- `GET /health`
- `GET /api/auth/me`
- `GET /api/proyectos`
- `GET /api/servicios`
- `GET /api/usuarios`
- `GET /api/horas`
- `GET /api/marcajes`
- Otros:

## Resultados k6

- Total requests:
- Requests fallidos:
- `http_req_failed`:
- `http_req_duration p95`:
- `http_req_duration p99`:
- Errores 5xx:
- Timeouts:
- Estados HTTP no esperados:

Adjuntar captura o resumen exportado de k6.

## Evidencia Vercel

- Ventana observada:
- Duracion de funciones:
- Invocaciones por endpoint:
- Errores:
- Timeouts:
- CPU throttling si esta disponible:
- Memoria usada si esta disponible:

Adjuntar captura de Vercel Observability.

## Evidencia Supabase

- Ventana observada:
- CPU promedio:
- CPU pico:
- RAM promedio:
- RAM pico:
- Conexiones activas:
- Queries lentas:
- I/O o IOPS si esta disponible:

Adjuntar captura de Supabase Reports o Database Health.

## Criterios de aprobacion

- CPU promedio Supabase < 70%: Si / No
- RAM promedio Supabase < 80%: Si / No
- Sin errores 5xx sostenidos: Si / No
- Sin timeouts: Si / No
- `http_req_failed < 1%`: Si / No
- `p95 < 2000 ms`: Si / No
- Sin degradacion severa en Vercel Functions: Si / No

## Conclusion

- Resultado final: Aprobado / Rechazado
- Observaciones:
- Acciones recomendadas:
