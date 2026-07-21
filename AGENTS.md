# Instrucciones para agentes

Antes de modificar el proyecto, leer completamente:

1. `docs/project-context.md`
2. `docs/architecture.md`
3. `docs/api-contract.md`

Reglas principales:

- Este repositorio contiene exclusivamente el frontend Angular.
- El backend será desarrollado por otra persona en otro repositorio.
- Avanzar módulo por módulo y no implementar módulos adicionales sin solicitud explícita.
- El diseño visual no es prioritario en la etapa actual.
- Mantener el frontend desacoplado del backend mediante contratos y adaptadores en `core/http`.
- No añadir secretos, documentos privados, `node_modules`, builds ni configuración local de agentes.
- Antes de entregar cambios ejecutar `pnpm build` dentro de `frontend/`.
