const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
function load(file) { const module = { exports: {} }; const js = ts.transpileModule(readFileSync(resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; new Function('exports', 'module', js)(module.exports, module); return module.exports; }
const { quantityMillis, buildReceiveRequest, buildLinkRequest } = load('src/app/features/imports/import-receiving.util.ts');
const { attachmentError } = load('src/app/features/procurement/purchase-document.util.ts');
function row(overrides = {}) { return { source: { importShipmentLineId: 'shipment-line', isReceivable: true, description: 'Máquina de prueba', pendingQuantity: '5.000', maxReceivableNow: '2.000', candidateReceiptLines: [{ purchaseReceiptLineId: 'receipt-line', availableToLinkQuantity: '3.000' }] }, quantity: '1.000', locationId: 'location', receiptLineId: 'receipt-line', submittedIndex: -1, ...overrides }; }
test('cantidad decimal exacta hasta tres decimales', () => assert.equal(quantityMillis('12.345'), 12345n));
test('rechaza cantidades negativas, coma y cuatro decimales', () => { for (const value of ['-1', '0,1', '1.0001', 'NaN']) assert.throws(() => quantityMillis(value)); });
test('recepción respeta máximo recibible de la factura, no solo del embarque', () => assert.throws(() => buildReceiveRequest([row({ quantity: '3' })], false, '2026-11-23', '')));
test('omitir cantidad cero conserva índices correctos de errores del servidor', () => { const skip = row({ quantity: '0' }), selected = row(); const result = buildReceiveRequest([skip, selected], true, '2026-11-23', ' demo '); assert.equal(result.lines.length, 1); assert.equal(skip.submittedIndex, -1); assert.equal(selected.submittedIndex, 0); assert.deepEqual(result.lines[0], { importShipmentLineId: 'shipment-line', quantity: '1.000', locationId: 'location' }); assert.equal(result.completeOperation, true); assert.equal(result.notes, 'demo'); });
test('no se registra recepción vacía', () => assert.throws(() => buildReceiveRequest([row({ quantity: '0' })], false, '2026-11-23', '')));
test('ubicación vacía usa el destino predeterminado sin enviar id falso', () => assert.equal(buildReceiveRequest([row({ locationId: '' })], false, '2026-11-23', '').lines[0].locationId, undefined));
test('vínculo usa solo recepción candidata y no crea líneas de inventario', () => { const result = buildLinkRequest([row()], false); assert.deepEqual(result, { links: [{ importShipmentLineId: 'shipment-line', purchaseReceiptLineId: 'receipt-line', linkedQuantity: '1.000' }], completeOperation: false }); assert.equal(result.lines, undefined); });
test('vínculo rechaza recepción ajena o cantidad excesiva', () => { assert.throws(() => buildLinkRequest([row({ receiptLineId: 'other' })], false)); assert.throws(() => buildLinkRequest([row({ quantity: '4' })], false)); });
test('archivo PDF/JPG/PNG con tamaño válido pasa validación de selección', () => { for (const [name, type] of [['a.pdf', 'application/pdf'], ['a.jpg', 'image/jpeg'], ['a.png', 'image/png']]) assert.equal(attachmentError({ name, type, size: 10 }), null); });
test('rechaza adjuntos vacíos, mayores a 10 MB y formatos no permitidos', () => { for (const file of [{ name: 'a.pdf', type: 'application/pdf', size: 0 }, { name: 'a.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1 }, { name: 'a.svg', type: 'image/svg+xml', size: 10 }]) assert.ok(attachmentError(file)); });
