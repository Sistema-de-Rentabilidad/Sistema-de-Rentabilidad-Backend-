# NF-13 - Consumo de CPU y memoria

Prueba no funcional automatizada para generar carga controlada sobre el backend Express desplegado y recolectar evidencia de consumo de recursos en Vercel y Supabase.

## Alcance

- Rama de implementacion inicial: `qa`.
- Objetivo de ejecucion: backend publico desplegado de `main`, configurado con `API_BASE_URL`.
- Tipo de carga: lectura controlada sobre endpoints criticos.
- No modifica datos productivos: el script solo ejecuta `GET`, salvo el login inicial opcional en `setup()`.
- La validacion de CPU y RAM se realiza principalmente en Supabase, porque Vercel Functions es serverless y no siempre expone CPU/RAM como un servidor tradicional.

## Herramienta

La prueba usa k6. Instalarlo antes de ejecutar:

```powershell
winget install k6.k6
k6 version
```

## Variables de entorno

Obligatoria:

```txt
API_BASE_URL=https://sistema-de-rentabilidad-backend.vercel.app
```

Autenticacion, elegir una opcion:

```txt
NF13_EMAIL=usuario_prueba_seguro@dominio.com
NF13_PASSWORD=********
```

O:

```txt
NF13_ACCESS_TOKEN_COOKIE=valor_cookie_temporal
```

Opcionales para ampliar cobertura:

```txt
NF13_PROJECT_ID=1
NF13_FASE_ID=2
NF13_NOTA_ID=1
NF13_TARGET_VUS=5
NF13_WARMUP_VUS=2
NF13_WARMUP_DURATION=1m
NF13_RAMPUP_DURATION=2m
NF13_SUSTAINED_DURATION=5m
NF13_COOLDOWN_DURATION=1m
NF13_REQUEST_TIMEOUT=10s
NF13_SLEEP_SECONDS=1
NF13_PROFILE=propietario
NF13_ENDPOINTS=health,auth_me,proyectos_list
```

No guardar credenciales, cookies ni URLs privadas en archivos versionados.

## Ejecucion

Con login:

```powershell
$env:API_BASE_URL="https://sistema-de-rentabilidad-backend.vercel.app"
$env:NF13_EMAIL="fatima@propietario.com"
$env:NF13_PASSWORD="<password-no-versionar>"
$env:NF13_PROJECT_ID="1"
$env:NF13_FASE_ID="2"
$env:NF13_NOTA_ID="1"
$env:NF13_PROFILE="propietario"
npm run test:nf:resource
```

Con cookie temporal:

```powershell
$env:API_BASE_URL="https://sistema-de-rentabilidad-backend.vercel.app"
$env:NF13_ACCESS_TOKEN_COOKIE="valor_cookie_temporal"
$env:NF13_PROJECT_ID="1"
npm run test:nf:resource
```

Guardar resumen ligero:

```powershell
npm run test:nf:resource -- --summary-export tests/non-functional/resource-usage/results/nf-13-summary.json
```

## Perfil de carga por defecto

- Warm-up: 1 minuto hasta 2 VUs.
- Ramp-up: 2 minutos hasta 5 VUs.
- Sustained load: 5 minutos con 5 VUs.
- Cool-down: 1 minuto hasta 0 VUs.

Este perfil es intencionalmente conservador porque apunta al despliegue publico de `main`.

## Datos de ejecucion del proyecto

Valores conocidos para este backend desplegado:

```txt
API_BASE_URL=https://sistema-de-rentabilidad-backend.vercel.app
NF13_PROJECT_ID=1
NF13_FASE_ID=2
NF13_NOTA_ID=1
```

Usuarios de prueba conocidos:

```txt
Propietario: fatima@propietario.com
Lider: jeremy@lider.com
Empleado: renzo@empleado.com
```

El password no debe guardarse en este README ni en ningun archivo versionado. Configurarlo solamente como variable de entorno al momento de ejecutar.

## Endpoints incluidos

Por defecto:

- `GET /health`
- `GET /api/auth/me`
- `GET /api/proyectos`

Disponibles para seleccionar con `NF13_ENDPOINTS`:

- `GET /api/servicios`
- `GET /api/usuarios`
- `GET /api/horas`
- `GET /api/marcajes`

Disponibles con `NF13_ENDPOINTS` y solo si se configuran IDs:

- `GET /api/proyectos/{NF13_PROJECT_ID}`
- `GET /api/proyectos/{NF13_PROJECT_ID}/horas-resumen`
- `GET /api/proyectos/{NF13_PROJECT_ID}/fases`
- `GET /api/proyectos/{NF13_PROJECT_ID}/notas`
- `GET /api/fases/{NF13_FASE_ID}`
- `GET /api/notas/{NF13_NOTA_ID}`

Nombres validos para `NF13_ENDPOINTS`:

```txt
health,auth_me,proyectos_list,servicios_list,usuarios_list,horas_list,marcajes_list,proyecto_detail,proyecto_horas_resumen,proyecto_fases,proyecto_notas,fase_detail,nota_detail
```

Perfiles validos para `NF13_PROFILE`:

```txt
propietario = health,auth_me,proyectos_list,servicios_list,usuarios_list,proyecto_detail,proyecto_horas_resumen,proyecto_fases,proyecto_notas
lider = health,auth_me,proyectos_list,marcajes_list,proyecto_horas_resumen,proyecto_fases,proyecto_notas
empleado = health,auth_me,proyectos_list,horas_list
```

Si se configura `NF13_ENDPOINTS`, ese valor tiene prioridad sobre `NF13_PROFILE`.

Si el usuario de prueba no tiene permisos para algun endpoint, k6 registrara estados no esperados. En ese caso debe ajustarse el usuario o reducirse la cobertura con `NF13_ENDPOINTS` antes de tomar la evidencia final.

## Metricas a revisar

k6:

- cantidad total de requests
- requests fallidos
- `http_req_duration`
- p95 y p99
- status codes
- errores 5xx
- timeouts

Vercel:

- duracion de funciones
- errores
- timeouts
- invocaciones por endpoint
- CPU throttling si esta disponible
- memoria usada si el plan/proyecto la expone

Supabase:

- CPU %
- RAM %
- conexiones activas
- queries lentas
- I/O o IOPS si esta disponible

## Criterios de aprobacion

NF-13 aprueba si durante la ventana de prueba:

- CPU promedio de Supabase menor a 70%.
- RAM promedio de Supabase menor a 80%.
- Sin timeouts.
- Sin errores 5xx sostenidos.
- `http_req_failed < 1%`.
- `p95 < 2000 ms`.
- `p99 < 4000 ms` como alerta.
- Sin degradacion severa en Vercel Functions.
- Sin saturacion sostenida de conexiones, CPU, RAM o queries lentas en Supabase.

NF-13 falla si hay saturacion sostenida, errores repetidos, timeouts o degradacion clara del backend durante la carga.

## Evidencia

Completar `evidence-template.md` por cada ejecucion y adjuntar capturas de:

- salida de k6
- Vercel Observability
- Supabase Reports o Database Health
