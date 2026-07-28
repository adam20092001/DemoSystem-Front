# Arquitectura del frontend

## Decisiones iniciales

- Repositorio dedicado exclusivamente al frontend Angular.
- Frontend standalone y rutas lazy por feature. Autenticación y usuarios consumen la API real; los módulos de negocio aún no implementados mantienen estado local de demostración.
- Seguridad real y reglas de negocio permanecerán en el backend externo.
- Contrato previsto: API REST `/api/v1`, autenticación JWT mediante cookie HttpOnly y `withCredentials`.

## Orden de módulos

1. Base visual, autenticación, layout y dashboard.
2. Catálogo: categorías, unidades y productos.
3. Inventario.
4. Clientes.
5. Cotizaciones.
6. Ventas / POS.
7. Pagos y cuentas por cobrar.
8. Contabilidad básica.
9. Reportes.
10. Configuración, usuarios y auditoría.

## Convención de feature

Cada feature mantiene sus páginas, componentes, modelos y servicios dentro de su carpeta. Las rutas se cargan de forma diferida y los elementos reutilizables viven en `shared`.

## Límite del repositorio

Este repositorio no contiene NestJS, Prisma, PostgreSQL, Docker de backend ni migraciones. Los tipos de request/response y adaptadores HTTP se implementarán en el frontend cuando se definan los contratos del repositorio de backend.
