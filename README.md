# 🚀 Entornos del Proyecto

## 📦 Desarrollo

Ejecuta el backend en entorno local de desarrollo:

```bash
npm run dev
```

### Configuración
- Usa `.env`
- Base de datos local/desarrollo
- Hot reload con `node --watch`

---

## 🧪 Entorno QA

Ejecuta el backend en entorno QA/testing:

```bash
npm run dev:qa
```

### Configuración
- Usa `.env.qa`
- Base de datos QA
- Logs QA
- Hot reload con `nodemon`

---

## 🌱 Seeds QA

Carga datos QA para pruebas funcionales:

```bash
npm run seed:qa
```

### Inserta datos de:
- Usuarios
- Empresas
- Servicios
- Proyectos
- Fases
- Registros de horas
- Marcajes
- Notas
- Relaciones entre entidades

---

## 🔄 Reset completo QA

Limpia la base QA, ejecuta seeds y levanta el backend QA:

```bash
npm run qa:reset
```

Ideal para:
- Testing manual
- QA funcional
- Demo del sistema
- Reiniciar datos rápidamente

---

## 🔐 Credenciales QA

| Rol | Email |
|---|---|
| Admin | `qa_admin@test.com` |
| Propietario | `qa_propietario@test.com` |
| Líder | `qa_lider@test.com` |
| Empleado | `qa_empleado1@test.com` |
| Empleado | `qa_empleado2@test.com` |

Password para todos:

```txt
Qa123456*
```

---

## 📌 Variables de entorno

| Entorno | Archivo |
|---|---|
| Desarrollo | `.env` |
| QA | `.env.qa` |

---

## 🧪 Pruebas automatizadas API

Las pruebas automatizadas del backend usan Jest + Supertest y cargan la configuración de `.env.qa`.

Ejecutar todas las pruebas Jest:

```bash
npm test
```

Ejecutar pruebas en modo watch:

```bash
npm run test:watch
```

Ejecutar pruebas con coverage:

```bash
npm run test:coverage
```

Ejecutar solo pruebas de API/integración con Supertest:

```bash
npm run test:api
```

Ejecutar colecciones Postman/Newman:

```bash
npm run test:postman
npm run test:postman:env
```

Por ahora la estructura queda preparada para empezar a escribir pruebas. No se incluyen pruebas con datos reales ni flujos complejos en esta configuración inicial.

---

## 📜 Scripts disponibles

```json
"scripts": {
  "start": "node src/server.js",
  "dev": "node --watch src/server.js",
  "seed:qa": "cross-env NODE_ENV=qa node seed/index.js",
  "dev:qa": "cross-env NODE_ENV=qa nodemon src/server.js",
  "qa:reset": "npm run seed:qa && npm run dev:qa",
  "test": "cross-env NODE_ENV=qa jest --passWithNoTests",
  "test:watch": "cross-env NODE_ENV=qa jest --watch --passWithNoTests",
  "test:coverage": "cross-env NODE_ENV=qa jest --coverage --passWithNoTests",
  "test:api": "cross-env NODE_ENV=qa jest --runInBand tests/integration --passWithNoTests",
  "test:postman": "newman run postman/collections/backend-qa.postman_collection.json",
  "test:postman:env": "newman run postman/collections/backend-qa.postman_collection.json -e postman/environments/qa.postman_environment.json"
}
```

> ⚠️ Los seeds QA solo deben ejecutarse sobre la base de datos QA.
