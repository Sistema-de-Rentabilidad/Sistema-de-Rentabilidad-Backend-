# Postman y Newman

Esta carpeta queda reservada para futuros recursos de QA de Postman para este backend.

## Que es Newman?

Newman es el ejecutor por consola de colecciones de Postman. Permite ejecutar colecciones exportadas desde Postman en la terminal y, mas adelante, integrarlas en flujos de QA o pipelines de CI.

## Para que se usara en este backend

Newman se usara para ejecutar colecciones de API del backend exportadas desde Postman.

## Estructura de carpetas

- `collections/`: aqui se deben guardar las colecciones exportadas desde Postman. Tipo de archivo esperado: `.postman_collection.json`.
- `environments/`: aqui se deben guardar los environments exportados desde Postman. Tipo de archivo esperado: `.postman_environment.json`.

El nombre esperado para la futura coleccion configurada en los scripts es:

```text
postman/collections/backend-qa.postman_collection.json
```

El nombre esperado para el futuro environment configurado en el script con entorno es:

```text
postman/environments/qa.postman_environment.json
```

Estos archivos todavia no existen. Deben exportarse desde Postman cuando las colecciones reales de QA esten listas.

## Como exportar una coleccion desde Postman

1. Abrir Postman.
2. Seleccionar la coleccion que se quiere exportar.
3. Abrir el menu de la coleccion.
4. Elegir `Export`.
5. Seleccionar el formato recomendado de coleccion.
6. Guardar el archivo en `postman/collections/`.

## Como exportar un environment desde Postman

1. Abrir Postman.
2. Ir a `Environments`.
3. Seleccionar el environment que se quiere exportar.
4. Abrir el menu del environment.
5. Elegir `Export`.
6. Guardar el archivo en `postman/environments/`.

## Comandos 

Ejecutar la coleccion sin environment:

```bash
npm run test:api
```

Ejecutar la coleccion con el environment de QA:

```bash
npm run test:api:env
```

Estos comandos quedan preparados para uso futuro y requieren que existan los archivos exportados esperados desde Postman para ejecutarse correctamente.
