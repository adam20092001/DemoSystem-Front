# Contrato REST propuesto para el frontend

Este documento define el contrato mínimo que el frontend espera del backend externo. Puede ajustarse cuando el equipo de backend publique su especificación OpenAPI.

## Base URL

- Desarrollo: `http://localhost:3000/api/v1`
- Producción: `/api/v1` o la URL configurada durante el despliegue.
- Autenticación: cookie HttpOnly; el frontend envía `withCredentials: true`.

## Respuesta de un recurso

Los endpoints de detalle pueden responder directamente con el recurso solicitado.

```json
{
  "id": "uuid",
  "name": "Ejemplo"
}
```

## Respuesta paginada

```json
{
  "data": [],
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "totalPages": 0
}
```

Parámetros comunes: `page`, `pageSize`, `sortBy`, `sortOrder` y filtros propios del recurso.

## Respuesta de error

```json
{
  "errorCode": "DUPLICATE_SKU",
  "message": "El SKU ya se encuentra registrado.",
  "details": {
    "field": "sku"
  },
  "traceId": "opcional"
}
```

`errorCode` es estable y sirve para comportamiento del frontend. `message` puede mostrarse al usuario cuando sea seguro. `details` y `traceId` son opcionales.

## Códigos HTTP esperados

- `200`: consulta o actualización correcta.
- `201`: creación correcta.
- `204`: operación correcta sin contenido.
- `400`: solicitud inválida.
- `401`: sesión inexistente o expirada.
- `403`: rol sin autorización.
- `404`: recurso inexistente.
- `409`: conflicto o duplicidad.
- `422`: regla de negocio incumplida.
- `500`: error inesperado.

## Regla de compatibilidad

El frontend centraliza el transporte HTTP. Si el backend adopta otro formato, se ajustan los interceptores y adaptadores en `core/http`, no cada pantalla.
