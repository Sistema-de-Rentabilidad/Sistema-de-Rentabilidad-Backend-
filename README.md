# 🚀 Entornos del Proyecto

## 📦 Desarrollo normal

Ejecuta el backend en entorno de desarrollo:

```bash
npm run dev
```

### Usa:
- `.env.development`
- Base de datos desarrollo
- Logs desarrollo

---

## 🧪 Entorno QA

Ejecuta el backend en entorno QA/testing:

```bash
npm run dev:qa
```

### Usa:
- `.env.qa`
- Base de datos QA
- Datos fake/seeds QA
- Swagger QA
- Logs QA

---

## 📌 Variables de entorno

El proyecto carga automáticamente el archivo `.env` según el entorno:

| Entorno | Archivo |
|---|---|
| Development | `.env.development` |
| QA | `.env.qa` |
| Production | `.env.production` |