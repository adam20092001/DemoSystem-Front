# Contexto de continuidad del proyecto

## Objetivo

Construir una demo frontend de un sistema web interno de punto de venta y gestión comercial para productos técnicos, equipos, repuestos y maquinaria.

El proyecto se basa en un documento maestro privado. Ese documento no se publica porque el repositorio GitHub es público. Este archivo conserva el contexto técnico necesario para continuar desde otra máquina.

## Alcance de este repositorio

- Únicamente frontend Angular.
- El backend NestJS, PostgreSQL y Prisma será desarrollado por otra persona en otro repositorio.
- La integración futura será mediante API REST con prefijo `/api/v1`.
- Autenticación prevista mediante JWT en cookie HttpOnly.
- El frontend debe enviar credenciales en las peticiones dirigidas a la API.

No implementar aquí:

- Backend, base de datos o migraciones.
- Docker de backend.
- Reglas de negocio que deban validarse de forma segura en el servidor.
- Datos reales, secretos o branding de una empresa específica.

## Stack y convenciones

- Angular 20 LTS.
- TypeScript estricto.
- Componentes standalone.
- SCSS.
- Rutas lazy por feature.
- Signals para estado local sencillo.
- RxJS para operaciones HTTP.
- Sin librería de UI por ahora; el diseño visual no es prioritario.

Estructura prevista para cada feature:

```text
feature/
├── pages/
├── components/
├── services/
├── models/
└── feature.routes.ts
```

## Roles previstos

- `ADMIN`
- `SELLER`
- `WAREHOUSE`
- `MANAGEMENT`

La autorización real siempre será responsabilidad del backend. Ocultar navegación o botones en el frontend solo mejora la experiencia.

## Orden acordado de implementación

1. Base transversal.
2. Autenticación y layout.
3. Usuarios y roles.
4. Catálogo: categorías, unidades y productos.
5. Inventario.
6. Clientes.
7. Cotizaciones.
8. Ventas y POS.
9. Pagos y cuentas por cobrar.
10. Contabilidad básica.
11. Dashboard y diez reportes.
12. Configuración y auditoría.
13. Ajustes y preparación final de la demo.

## Estado actual

Se comenzó el punto 1: base transversal.

Implementado:

- Proyecto Angular inicial y compilable.
- Organización inicial `core`, `layout`, `shared` y `features`.
- Ambientes de desarrollo y producción.
- Configuración inyectable de la API.
- `HttpClient` global.
- Cliente HTTP genérico.
- Interceptor de credenciales.
- Interceptor para normalizar errores.
- Interceptor y servicio de loading con contador de solicitudes.
- Modelos de error y paginación.
- Contrato REST provisional en `docs/api-contract.md`.
- Prototipos visuales existentes de login, layout, dashboard y rutas placeholder. No deben considerarse módulos terminados.

La compilación de producción pasa con `pnpm build`.

## Próximo paso acordado

Continuar el punto 1 con elementos compartidos básicos, sin invertir todavía en diseño:

1. Componente o indicador global de loading.
2. Estado vacío reutilizable.
3. Servicio y contenedor de notificaciones.
4. Confirmación reutilizable para acciones críticas.
5. Después, decidir pruebas unitarias mínimas para los servicios e interceptores transversales.

No avanzar aún hacia autenticación real, usuarios, catálogo u otros módulos sin una nueva instrucción del usuario.

## Contrato con el backend

El backend todavía no existe y será responsabilidad de otra persona. El contrato de `docs/api-contract.md` es una propuesta frontend, no una especificación definitiva.

Cuando exista Swagger/OpenAPI:

- Comparar su contrato con `docs/api-contract.md`.
- Ajustar adaptadores e interceptores dentro de `core/http`.
- Evitar cambios repetidos en cada pantalla.
- No asumir endpoints o payloads de negocio antes de coordinarlos.

## Documento maestro privado

El documento maestro no está en GitHub. En la máquina original existe una copia local fuera del control de versiones. Si se necesita consultar en otra máquina, debe transferirse por un medio privado y mantenerse fuera del repositorio público.

El `.gitignore` excluye `frontend/src/doc/` para evitar publicarlo accidentalmente.

## Comandos

Desde la raíz del repositorio:

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm start
```

Verificación:

```bash
cd frontend
pnpm build
```

## Archivos locales que no se versionan

- Documento maestro privado.
- `.claude/`, `.codex/` y `.agents/`.
- `frontend/skills-lock.json`.
- `node_modules/`, `dist/`, `.angular/`, cobertura y logs.
- Archivos `.env` o credenciales.
