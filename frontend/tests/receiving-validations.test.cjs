const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
function load(file) {
  const module = { exports: {} };
  const js = ts.transpileModule(readFileSync(resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'module', js)(module.exports, module);
  return module.exports;
}
const purchase = load('src/app/features/procurement/purchase-receipt.util.ts');
const receiving = load('src/app/features/imports/import-receiving.util.ts');
const workflow = load('src/app/features/imports/import-workflow.util.ts');
const invoice = { id: 'invoice', lines: [{ id: 'line', isReceiptEligible: true }, { id: 'service', isReceiptEligible: false }] };
const summary = (pending = '0', received = '5') => ({ purchaseInvoiceId: 'invoice', lines: [{ purchaseInvoiceLineId: 'line', pendingQuantity: pending, receivedQuantity: received }, { purchaseInvoiceLineId: 'service', pendingQuantity: '10', receivedQuantity: '0' }] });
function line(overrides = {}) { return { importShipmentLineId: 'line', purchaseInvoiceLineId: 'invoice-line', isReceivable: true, pendingQuantity: '5', linkedQuantity: '0', maxReceivableNow: '5', invoicePendingReceivableQuantity: '5', candidateReceiptLines: [], ...overrides }; }
function shipment(lines = [line()], overrides = {}) { return { importShipmentId: 'shipment', status: 'ARRIVED', canReceive: true, lines, ...overrides }; }
function info(shipments = [shipment()], overrides = {}) { return { status: 'IN_PROGRESS', canReceive: true, shipments, ...overrides }; }
function row(source, quantity = '5') { return { source, quantity, locationId: '', receiptLineId: 'receipt', submittedIndex: -1 }; }

test('compra totalmente recibida no ofrece pendientes aunque incluya servicios', () => { assert.deepEqual(purchase.pendingReceiptLines(invoice, summary()), []); assert.equal(purchase.purchaseReceptionState(invoice, summary()), 'Recepción completa'); });
test('compra parcialmente recibida ofrece solo líneas inventariables pendientes', () => { assert.equal(purchase.pendingReceiptLines(invoice, summary('2', '3')).length, 1); assert.equal(purchase.purchaseReceptionState(invoice, summary('2', '3')), 'Recepción parcial'); });
test('sin recepciones y sin mercadería se distinguen de recepción completa', () => { assert.equal(purchase.purchaseReceptionState(invoice, summary('5', '0')), 'Recepción pendiente'); assert.equal(purchase.purchaseReceptionState({ id: 'invoice', lines: [] }, summary()), 'Sin mercadería por recibir'); });
test('no reutiliza el resumen de otra compra', () => assert.equal(purchase.pendingReceiptLines({ ...invoice, id: 'other' }, summary('5')).length, 0));
test('recepción de compra rechaza repetir, exceso, negativos, NaN y precisión inválida', () => { for (const quantity of ['6', '-1', 'NaN', '1.0001']) assert.throws(() => purchase.purchaseReceiptLines(invoice, summary('5'), { line: quantity }, {})); assert.throws(() => purchase.purchaseReceiptLines(invoice, summary(), { line: '1' }, {})); });
test('recepción parcial de compra conserva ubicación sin recibir líneas de servicios', () => { assert.deepEqual(purchase.purchaseReceiptLines(invoice, summary('5'), { line: '2.000' }, { line: 'location' }), [{ purchaseInvoiceLineId: 'line', quantity: '2.000', locationId: 'location' }]); assert.throws(() => purchase.purchaseReceiptLines(invoice, summary('5'), { service: '1' }, {})); });
test('importación distingue recepción completa, parcial y pendiente de vincular', () => { assert.equal(receiving.shipmentReceptionState(shipment([line({ pendingQuantity: '0', linkedQuantity: '5' })])), 'Recepción completa'); assert.equal(receiving.shipmentReceptionState(shipment([line({ pendingQuantity: '2', linkedQuantity: '3' })])), 'Recepción parcial'); assert.equal(receiving.shipmentReceptionState(shipment([line({ maxReceivableNow: '0', candidateReceiptLines: [{}] })])), 'Pendiente de vincular recepción'); });
test('recepción parcial no permite completar importación', () => assert.ok(receiving.completionBlock(info(), 'shipment', [row(line(), '2')])));
test('recepción total permite completar y embarque anulado no cuenta como pendiente', () => assert.equal(receiving.completionBlock(info([shipment(), shipment([line()], { status: 'CANCELLED', importShipmentId: 'cancelled' })]), 'shipment', [row(line())]), null));
test('otro embarque pendiente o en tránsito impide completar', () => { for (const status of ['ARRIVED', 'IN_TRANSIT', 'PLANNED']) assert.ok(receiving.completionBlock(info([shipment(), shipment([line()], { status, importShipmentId: 'other' })]), 'shipment', [row(line())])); });
test('fallo de consulta y operación cerrada no permiten completar', () => { assert.ok(receiving.completionBlock(null, 'shipment', [])); assert.ok(receiving.completionBlock(info([], { status: 'COMPLETED', canReceive: false }), '', [])); });
test('dos filas no pueden consumir juntas más saldo de la misma factura', () => assert.throws(() => receiving.buildReceiveRequest([row(line(), '3'), row(line({ importShipmentLineId: 'line-2' }), '3')], false, '2026-11-23', '')));
test('dos vínculos no pueden consumir dos veces la misma recepción', () => { const source = line({ candidateReceiptLines: [{ purchaseReceiptLineId: 'receipt', availableToLinkQuantity: '5' }] }); assert.throws(() => receiving.buildLinkRequest([row(source, '3'), row({ ...source, importShipmentLineId: 'line-2' }, '3')], false)); });
test('operaciones completadas o anuladas no admiten cambios de embarques', () => { for (const status of ['COMPLETED', 'CANCELLED']) for (const action of ['edit', 'depart', 'arrive', 'cancel']) assert.equal(workflow.shipmentActionAllowed({ status }, { status: 'PLANNED' }, action), false); });
test('salida, llegada y edición respetan su estado logístico', () => { assert.equal(workflow.shipmentActionAllowed({ status: 'IN_PROGRESS' }, { status: 'PLANNED' }, 'depart'), true); assert.equal(workflow.shipmentActionAllowed({ status: 'IN_PROGRESS' }, { status: 'IN_TRANSIT' }, 'edit'), false); assert.equal(workflow.shipmentActionAllowed({ status: 'IN_PROGRESS' }, { status: 'ARRIVED' }, 'arrive'), false); });
test('no se ofrece anular una operación con mercadería arribada', () => { assert.equal(workflow.operationCanCancel({ status: 'IN_PROGRESS' }, [{ status: 'ARRIVED' }]), false); assert.equal(workflow.operationCanCancel({ status: 'DRAFT' }, []), true); });
