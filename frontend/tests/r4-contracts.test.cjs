const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const { resolve } = require('node:path');
function load(file) { const module = { exports: {} }; const js = ts.transpileModule(readFileSync(resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; new Function('exports', 'module', js)(module.exports, module); return module.exports; }
const { moneyCents, sumPaymentAmounts } = load('src/app/features/procurement/payment-amount.util.ts');
const { operationPayload, shipmentPayload } = load('src/app/features/imports/import-payload.util.ts');
test('sumas exactas sin errores de punto flotante', () => assert.equal(sumPaymentAmounts(['0.10', '0.20']), '0.30'));
test('sumas grandes y centavos exactos', () => assert.equal(sumPaymentAmounts(['999999999999.99', '0.01']), '1000000000000.00'));
test('rechaza negativos, comas, NaN y más de dos decimales', () => { for (const value of ['-1', '1,20', 'NaN', '1.001']) assert.throws(() => moneyCents(value)); });
test('normaliza fracciones y aplicaciones vacías', () => assert.equal(sumPaymentAmounts(['1.2', '0', '']), '1.20'));
test('la creación de importación no envía referencia, proveedor ni id', () => { const result = operationPayload({ purchaseInvoiceId: 'invoice', reference: 'manual', supplierId: 'other', id: 'op', originCountry: ' cn ', destinationCountry: 'pe', description: ' prueba ' }); assert.deepEqual(JSON.parse(JSON.stringify(result)), { purchaseInvoiceId: 'invoice', originCountry: 'CN', destinationCountry: 'PE', description: 'prueba' }); });
test('INCOTERM lleva lugar y versión, sin campos de estado', () => { const result = shipmentPayload({ id: 'x', status: 'ARRIVED', incoterm: 'CIP', incotermNamedPlace: ' Callao ', transportMode: 'SEA', lines: [{ purchaseInvoiceLineId: 'l1', plannedQuantity: '1', id: 'other' }] }); assert.equal(result.incotermNamedPlace, 'Callao'); assert.equal(result.incotermVersion, '2020'); assert.equal(result.status, undefined); assert.equal(result.lines[0].id, undefined); assert.equal(result.lines[0].purchaseInvoiceLineId, 'l1'); });
test('quitar INCOTERM limpia sus tres campos', () => { const result = shipmentPayload({ incoterm: null, incotermNamedPlace: 'anterior', incotermVersion: '2020', transportMode: 'AIR', lines: [] }); assert.equal(result.incoterm, null); assert.equal(result.incotermNamedPlace, null); assert.equal(result.incotermVersion, null); });
