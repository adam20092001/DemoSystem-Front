# Integración R5 — 23/11/2026

Backend revisado: `830b8c9` (R5 purchase attachments and import receiving). No se modificó su código ni se ejecutaron seeds.

## Preparación

- Respaldo previo de la demo: `C:\Demo\backups\pre-r5-20261123.dump`.
- Ensayo de restauración y migración en `pos_db_r5_check_20261123`.
- Migración `20261125000000_add_purchase_attachments_and_import_receiving` aplicada después a la demo; Prisma Client regenerado. Total: 40 migraciones.
- Backend y Angular reiniciados. Frontend en puerto 4201 y API en 3000.
- Nueva dependencia de frontend: `pdfjs-dist` 6.5.438. Se publica su worker y recursos con Angular; sin enlaces públicos a documentos privados.

## Funcionalidad

- Compras: adjuntar múltiples PDF/JPG/PNG (10 MB por archivo), ver, descargar y retirar solo en borrador. Compras confirmadas admiten documentos complementarios. Cada archivo conserva su clave de reintento mientras permanece en la cola; recargar descarta la cola, pero los documentos ya guardados se consultan desde el servidor.
- Importaciones: consulta de los mismos adjuntos de la compra vinculada, sin duplicar archivos.
- Recepción desde embarques ARRIVED: cantidad pendiente del embarque y de la factura, máximo recibible, cantidades parciales, fecha, notas y ubicación.
- Vinculación de recepciones ya registradas sin crear otro movimiento de stock.
- Recibir/vincular y completar en una solicitud; el servidor rechaza todo si el cierre no es posible.
- Reintento de recepción con la misma clave y contenido; se conserva el intento en sessionStorage para recargar la misma pestaña sin crear otra recepción. No representa un borrador de negocio ni reemplaza la información del servidor.
- ADMIN/PURCHASING pueden escribir; MANAGEMENT/ACCOUNTANT solo consultar, según contrato R5.
- Confirmaciones de salida, llegada, cierre y retiro de adjuntos integradas en la aplicación.

## Verificación ejecutada

- Compilación de producción de Angular.
- 17 pruebas de contratos frontend R4/R5: importes exactos, payloads, límites de recepción, vínculos y validación de archivos.
- 22 pruebas unitarias del backend existente: validación de documentos, servicio de adjuntos y servicio de recepción.
- UI: subida del PDF ficticio `r5-factura-demo.pdf`, persistencia al recargar, visualización con PDF.js y descarga del original.
- API autenticada sobre la importación ficticia `IMP-2026-000001`: arribo sin modificar stock (15), rechazo 409 al intentar recibir 2 cuando quedaba 1, recepción de 1 con cierre, stock final 16 y pendiente 0. Repetición idéntica devuelve el resultado previo y no duplica stock.
- Recepción de prueba: `cf28f960-52f2-4258-98fb-67feff11b5dd`.
- La prueba visual de recepción quedó limitada por una confirmación nativa bloqueada del navegador de pruebas; el flujo transaccional se comprobó por API. No se afirma cobertura E2E visual completa de recepción parcial ni de vinculación de recepciones existentes.

## Operación y pendientes

### Refuerzo de validaciones del frontend

- Nuevas importaciones: lista paginada completa de compras, filtrada con recepciones vigentes y disponibilidad global de factura consultada desde una operación vinculada cuando existe. Se revalida la compra al seleccionarla y antes de crear. Se excluyen compras confirmadas totalmente recibidas, anuladas, sin líneas inventariables o con todas las cantidades asignadas conocidas. Se conserva el alta de compras borrador desde Importaciones.
- Embarques: opciones sin saldo deshabilitadas; agregar líneas se bloquea cuando el formulario consume todo el disponible. Líneas persistidas que agotaron lo facturado quedan bloqueadas en compra/producto, cantidad y retiro; descripción y unidad vinculadas se heredan de la factura. Los datos logísticos de un embarque planificado siguen editables.
- Verificación acumulada: 52 pruebas frontend. UI sin escrituras: compras completas excluidas del selector de nueva importación y guardado bloqueado sin compra válida.
- Solicitud adicional al backend: rechazar transaccionalmente nuevas importaciones sobre compras totalmente recibidas/sin saldo; exponer un listado paginado de compras importables y saldos por línea (incluyendo asignaciones históricas sin operación principal vinculada). Sin ese listado, el frontend compone consultas existentes y no puede garantizar disponibilidad global de una factura que solo tiene embarques históricos sin vínculo principal. No se ha inventado ni persistido un catálogo local de saldos.
- Recepción total en Compras: no se ofrece otra recepción; parcial: se ofrece recibir el saldo. Se excluyen conceptos no inventariables y resúmenes de otra factura.
- Consultas en curso o fallidas: no habilitan acciones sobre cantidades anteriores. El cierre independiente vuelve a consultar los pendientes antes de enviarse.
- Importaciones completadas/anuladas: solo consulta para embarques, gastos y vínculos. No se ofrece anular una operación con embarques arribados.
- Recepción de importación: estado pendiente/parcial/completo/pendiente de vinculación; máximos de cantidad y protección contra consumir dos veces el mismo saldo de factura o recepción en varias filas.
- La opción de recibir/vincular y completar anticipa el saldo posterior de todos los embarques. Las fechas en pantalla verifican llegada no anterior a salida y recepción no anterior a llegada cuando la fecha logística existe.
- Verificados 33 tests frontend y compilación de producción. Comprobación visual sin escrituras: importación `IMP-2026-000002` en solo consulta y factura `PFW2012452-23` totalmente recibida sin botón de nueva recepción, también tras actualizar.
- Estas restricciones son de interfaz, no una garantía transaccional: sigue pendiente unificar validación de pendientes en el cierre independiente del servidor, bloqueo de cambios/reversiones sobre expedientes cerrados, reglas cronológicas con excepciones autorizadas y política de cierre de costos.

- Los documentos se guardan en el almacenamiento privado del backend (`uploads/purchase-documents` por defecto o `PURCHASE_DOCUMENTS_DIR`). Respaldar esa carpeta junto con PostgreSQL: un dump SQL no contiene los bytes de los adjuntos.
- CIP no implica agregar automáticamente otro flete ni calcular el costo puesto en almacén. Falta el contrato para distinguir incluidos/adicionales, distribuir por valor y capitalizar/conversiones; no se ha simulado ese comportamiento.
- Quedan recomendadas pruebas visuales por rol (ADMIN, PURCHASING, MANAGEMENT, ACCOUNTANT), recepción parcial, vínculo previo y recarga tras una respuesta perdida.
