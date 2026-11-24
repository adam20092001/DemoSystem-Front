# Integración R4 de Compras e Importaciones

## Activación local

- Respaldo: `C:/Demo/backups/pre-r4-20261123.dump`.
- Ensayo: clon `pos_db_r4_check_20261123`, conservado para inspección.
- Aplicadas las cuatro migraciones nuevas y generado Prisma. Base local: 39 migraciones finalizadas.
- Se conservaron usuarios, productos y documentos históricos. No se ejecutaron seeds ni limpiezas.
- Backend reiniciado con registro en `C:/Demo/backend-r4.out.log`; código fuente del backend sin modificar.

## Frontend

- Compra: moneda, tasa manual, fecha de cambio, importes originales y equivalentes en moneda de la empresa. Precio unitario extranjero visible hasta seis decimales.
- Importación: compra DRAFT/CONFIRMED obligatoria, referencia no editable asignada por el servidor, proveedor heredado y alta de compra embebida. No confirma automáticamente la compra.
- Embarque: líneas únicamente de la compra CONFIRMED vinculada, disponibilidades devueltas por el servidor, INCOTERM, lugar requerido y versión 2020. Restricción marítima para FAS/FOB/CFR/CIF. No crea recepción automática ni stock.
- Países: consulta y alta reales en `/countries`, compartidas entre usuarios. Alta para ADMIN/PURCHASING; sin listas locales como fuente autoritativa. Mantiene los códigos históricos e inactivos del registro actual.
- Cuentas por pagar: cada documento conserva su moneda, los agregados usan la moneda contable y muestran desglose original. Pagos solo del mismo proveedor y moneda, tasa y fecha propias, importes y diferencia cambiaria visibles. Sumas exactas en centavos y clave de idempotencia estable durante el reintento del formulario.
- Plan de cuentas: expuestas `FX_GAIN_REALIZED` y `FX_LOSS_REALIZED`. No se asignaron cuentas automáticamente; ADMIN debe configurarlas si se usarán diferencias cambiarias.
- Errores: se conservan `kind` y `errors[]` del servidor, resaltando campos identificados por sus rutas, incluidas líneas. Los avisos generales siguen cerrándose a los cinco segundos.
- Permisos de Compras ampliados conforme a R3/R4; edición de catálogo, contabilidad y configuración conservan sus autorizaciones previas.

## Verificación

- 70 pruebas unitarias seleccionadas del backend pasan después de generar Prisma.
- `node --test tests/r4-contracts.test.cjs`: siete pruebas de cálculo decimal exacto y limpieza de cuerpos enviados.
- Compilación Angular de producción verificada.
- Prueba manual en pantalla estrecha y escritorio: compra USD desde Importaciones, correlativo, factura confirmada, embarque CIP persistido con lugar obligatorio y únicamente su línea de compra, error de país duplicado asociado al campo, pago USD con equivalencia PEN y acceso con PURCHASING.
- Documentos de prueba conservados para inspección: compra `DEMO-R4-UI-USD-001` (USD 100.12, tasa 3.70, PEN 370.44), importación `IMP-2026-000001`, embarque planificado CIP y pago con la misma tasa. No se recibió físicamente mercadería ni se alteró stock en esta prueba.
- Se agregó el país US / Estados Unidos desde PURCHASING; se canceló la edición del país de origen de la importación (sigue CN).

## Pendientes de backend (no simulados)

- Adjuntar factura PDF/imagen.
- Recibir mercadería y completar importación mediante un flujo integrado con control de fallos.
- Gastos incluidos en factura frente a adicionales y prevención de doble flete/seguro en CIP.
- Reparto por valor y costo final de importación con tratamiento contable aprobado.

La existencia de multimoneda en compras NO implementa multimoneda ni capitalización automática en gastos de importación. El flujo de recepción integrada sigue pendiente.
