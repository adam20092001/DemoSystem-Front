# Solicitudes para compras e importaciones

## Estado actualizado — integración R5, 23/11/2026

- Backend `830b8c9`, migración 40 aplicada después de respaldo y ensayo en una base clonada; sin seeds ni cambios al código del backend.
- Integrados adjuntos PDF/JPG/PNG de compras, consulta desde Importaciones, visor PDF, descarga autenticada y retiro de adjuntos mientras la compra es borrador.
- Integrada recepción desde embarques arribados: cantidades parciales, ubicación, vinculación de recepciones existentes, reintentos idempotentes y recepción con cierre atómico.
- La llegada logística y el cierre por sí solos NO ingresan inventario. Las importaciones nuevas se completan desde el flujo de recepción; las históricas conservan su cierre anterior.
- Pendiente del backend: tratamiento de gastos incluidos/adicionales según INCOTERM (especialmente CIP), reparto por valor monetario y capitalización/conversión de gastos. No completar esos cálculos solo en el frontend.
- Verificación y límites de prueba en `r5-integracion-frontend.md`. Los apartados R4 y los requerimientos originales siguientes se conservan como historial.

## Estado actualizado — integración R4, 23/11/2026

- Backend revisado: `13bd2c6`. Migraciones 36–39 aplicadas tras respaldo y ensayo en clon aislado; no se ejecutaron seeds.
- Integrado en frontend: compras multimoneda, importes originales/contables, pagos en la moneda de las facturas, tipo de cambio del pago, diferencias cambiarias, claves FX en Plan de cuentas, INCOTERM, compra principal obligatoria, correlativo del servidor, proveedor heredado, embarques limitados a líneas de la factura, países persistentes y errores por campo.
- Habilitados los permisos PURCHASING que el servidor autorizó en R3/R4, sin ampliar acceso a contabilidad, inventario manual ni alta de productos.
- Conservadas las importaciones históricas como `isLegacyUnlinked`; no se les asignó factura automáticamente.
- Pendientes reales: adjuntos PDF/imágenes de compras; recepción integrada desde Importaciones; distinción de gastos incluidos frente a adicionales (CIP), reparto por valor monetario y capitalización/conversión de gastos de importación. No confundir INCOTERM con automatización de costos.
- Las secciones siguientes conservan los requerimientos originales y el diagnóstico previo a R4. Sus referencias a funciones ausentes o listas locales describen ese estado anterior, no la integración actual.

## Pendiente acordado: recibir mercadería desde Importaciones

Estado: implementado en R5. Se conservan abajo los criterios solicitados para futuras regresiones.

Decisión del usuario: automatizar la creación de la recepción desde Importaciones con confirmación explícita de cantidades y ubicación; NO aumentar inventario solo al marcar un embarque como arribado ni al cerrar el expediente.

- Ofrecer acciones «Recibir mercadería» y «Recibir mercadería y completar».
- Mostrar líneas de la compra confirmada vinculada, cantidades facturadas/asignadas, recibidas y pendientes, considerando recepciones previas vinculadas y no vinculadas.
- Pedir cantidades efectivamente recibidas, fecha y almacén/ubicación de destino; admitir recepciones parciales sin cerrar la operación.
- Reutilizar la recepción de compra y el motor de inventario existentes; crear vínculos con líneas de embarque sin un segundo movimiento de stock.
- Evitar sobre-recepción, doble contabilización y duplicados ante reintentos o solicitudes concurrentes mediante validación transaccional e idempotencia.
- Para «Recibir mercadería y completar», validar de antemano las condiciones actuales de cierre y que no queden cantidades pendientes en embarques no anulados. Si faltan cantidades, ofrecer recibir parcialmente y mantener abierta la operación, nunca cerrar silenciosamente.
- Mantener la posibilidad de vincular recepciones ya existentes sin aumentar stock otra vez. El cierre de una operación ya recibida tampoco debe mover inventario.
- Definir un contrato atómico para recibir, vincular y completar: ante fallo, no dejar movimientos, vínculos o cierre a medias. Si se permiten pasos separados, la respuesta debe identificar cada resultado y admitir reintentos seguros.
- Conservar permisos existentes; si ADMIN es el único rol que puede recibir desde Importaciones, no habilitarlo a otros roles sin autorización explícita del backend.
- Devolver recepción, vínculos, cantidades pendientes y estado final de la operación; registrar auditoría y mantener el tratamiento contable/de valorización propio de la recepción existente, sin reconocer otra vez la compra.

Aceptación: recepción total con cierre; recepción parcial sin cierre; recepción previa vinculada sin duplicar stock; doble clic/reintento/concurrencia sin duplicados; cantidades excesivas o ubicación inválida rechazadas sin cambios parciales; llegada y cierre logístico sin ingreso automático; usuarios sin permiso rechazados.

El frontend conserva los contratos actuales. No se ha modificado el backend ni se han guardado relaciones nuevas en notas, referencias libres o almacenamiento local.

## Compras multimoneda

- Admitir moneda del documento y tipo de cambio explícito con fecha y sentido definido (moneda del documento → moneda funcional).
- Conservar importes originales, tipo de cambio histórico e importes convertidos, usando decimales exactos y una política de redondeo definida por contabilidad.
- Exponerlos en creación, edición de borradores, detalle, listados, reportes y exportaciones.
- Definir el tratamiento en confirmación contable, valorización, pagos, saldos y anulaciones. No recalcular historia con un cambio posterior.
- Hoy `CreatePurchaseInvoiceDto` no acepta moneda ni cambio; el servicio impone la moneda de la empresa. No basta con agregar dos campos en pantalla.

## Importación vinculada a una compra

- Correlativo generado por el servidor, único y seguro ante solicitudes simultáneas (definir formato, serie y reinicio).
- Una compra/factura obligatoria por operación y proveedor derivado de ella. Confirmar si se admiten borradores o solo compras confirmadas (hoy los embarques solo admiten líneas de compras confirmadas).
- Productos exclusivamente de esa factura; impedir cantidades asignadas superiores a las disponibles considerando otros embarques concurrentes.
- Exponer compra, documento y proveedor en listados y detalle. Definir edición, anulación y migración de importaciones existentes que hoy pueden consolidar varias facturas.
- Crear compra desde la pantalla de importaciones reutilizando el flujo de compras, sin confirmarla automáticamente ni duplicar documentos ante reintentos.
- Hoy el vínculo existe solo por línea de embarque; la operación no admite `purchaseInvoiceId` ni `supplierId` y la referencia es manual. No presentar una referencia libre como vínculo real.

## Catálogo compartido de países

- Listar y dar de alta países con código ISO alpha-2 y nombre; permisos y validación de duplicados.
- Inicializar China (CN), Perú (PE), India (IN), sin borrar países ya usados.
- Compartir el catálogo en proveedores, importaciones y futuras pantallas; conservar referencias de documentos históricos.
- El selector de frontend ya permite estos tres países y agregar una selección ISO durante la sesión. El código elegido sí se guarda en el proveedor/importación mediante los campos actuales. La lista ampliada NO es un catálogo persistente compartido entre usuarios: esa persistencia necesita API.

## Permisos

El alta de productos desde Compras reutiliza el formulario existente, solo para ADMIN, conforme al permiso actual. Si PURCHASING también debe crear productos, solicitar el cambio de permisos en el backend antes de habilitar la acción.

## Verificación funcional

1. Abrir Registrar compra, intentar guardar vacío: resaltar y enfocar proveedor y número.
2. Crear proveedor desde esa compra: mantener las líneas y seleccionar el proveedor creado.
3. Como ADMIN crear producto con el formulario de catálogo: seleccionarlo en la línea de origen; comprobar también carga fallida de imagen y reintento.
4. Cancelar cualquiera de las altas: mantener el borrador de compra.
5. Elegir/agregar país en proveedor e importación: comprobar código persistido al guardar y recargar el documento.
6. Revisar ventanas a 390, 768 y 1440 px, tablas con desplazamiento interno y formularios sin desbordamiento.
