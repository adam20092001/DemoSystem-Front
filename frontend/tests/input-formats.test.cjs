const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve, join } = require('node:path');
const ts = require('typescript');
function load(file) {
  const module = { exports: {} };
  const js = ts.transpileModule(readFileSync(resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'module', 'require', js)(module.exports, module, () => ({ ApiRequestError: class extends Error {} }));
  return module.exports;
}
const formats = load('src/app/shared/input-format.util.ts');
const commercial = load('src/app/features/commercial/commercial.util.ts');
test('fecha escrita en DDMMYYYY se presenta con separadores', () => assert.equal(formats.maskDateInput('23112026'), '23/11/2026'));
test('fecha visible se convierte a ISO sin invertir día y mes', () => assert.equal(formats.parseDisplayDate('03/04/2026'), '2026-04-03'));
test('mantiene escritura parcial de una fecha sin inventar año ni día', () => { assert.equal(formats.maskDateInput('2311'), '23/11'); assert.equal(formats.parseDisplayDate('23/11'), null); });
test('rechaza fechas imposibles y respeta años bisiestos', () => { assert.equal(formats.parseDisplayDate('29/02/2028'), '2028-02-29'); for (const date of ['29/02/2026', '31/04/2026', '00/11/2026', '23/13/2026', '23/11/26']) assert.equal(formats.parseDisplayDate(date), null); });
test('valida límites de recepción en ISO conservando formato visible', () => { assert.ok(formats.dateInputError('22/11/2026', '2026-11-23')); assert.equal(formats.dateInputError('23/11/2026', '2026-11-23'), ''); assert.ok(formats.dateInputError('24/11/2026', '', '2026-11-23')); });
test('fecha opcional vacía no se transforma en una fecha real', () => { assert.equal(formats.displayDate(''), ''); assert.equal(formats.dateInputError(''), ''); });
test('fechas de listados y horas llevan año de cuatro cifras y zona Lima', () => { assert.equal(commercial.shortDate('2026-11-23'), '23/11/2026'); assert.equal(commercial.shortDate('2026-11-24T02:00:00Z'), '23/11/2026'); assert.equal(commercial.dateTime('2026-11-24T02:00:00Z'), '23/11/2026 21:00'); });
test('dinero completa dos decimales y separador de miles', () => { assert.equal(formats.formatMoneyInput('1250'), '1,250.00'); assert.equal(formats.formatMoneyInput('1250.5'), '1,250.50'); assert.equal(formats.formatMoneyInput('0'), '0.00'); });
test('dinero vacío permanece vacío', () => { assert.equal(formats.formatMoneyInput(''), ''); assert.equal(formats.parseMoneyInput(''), ''); });
test('pegar importes formateados devuelve decimal limpio para backend', () => { assert.equal(formats.parseMoneyInput('S/ 1,250.50'), '1250.50'); assert.equal(formats.parseMoneyInput('1,250.50'), '1250.50'); assert.equal(formats.parseMoneyInput('1250,50'), '1250.50'); assert.equal(formats.parseMoneyInput('1,250'), '1250'); });
test('no redondea silenciosamente un importe con precisión excesiva', () => { assert.equal(formats.parseMoneyInput('12.345', 2), null); assert.equal(formats.parseMoneyInput('12.345678', 6), '12.345678'); assert.equal(formats.formatMoneyInput('1234.345678', 6), '1,234.345678'); });
test('formato exacto de cantidades monetarias grandes sin punto flotante', () => assert.equal(formats.formatMoneyInput('9999999999999999.99'), '9,999,999,999,999,999.99'));
test('no acepta NaN, exponentes, signos ni agrupación corrupta', () => { for (const value of ['NaN', '1e4', '-1', '1,23,45', '1.2.3']) assert.equal(formats.parseMoneyInput(value), null); });
test('todos los campos de fecha de módulos usan el control compartido', () => {
  function files(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(join(directory, item.name)) : [join(directory, item.name)]); }
  for (const file of files(resolve(__dirname, '../src/app/features')).filter(file => /\.(html|ts)$/.test(file))) assert.doesNotMatch(readFileSync(file, 'utf8'), /<input\b[^>]*type="date"/, file);
});
