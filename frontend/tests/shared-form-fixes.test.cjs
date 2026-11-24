const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const { of, firstValueFrom } = require('rxjs');
const read = file => readFileSync(resolve(__dirname, '..', file), 'utf8');

function supplierService() {
  const rows = new Map([['existing', { id: 'existing', legalName: 'Proveedor de factura histórica', status: 'INACTIVE' }]]);
  const api = { get(path) { return of(path === 'suppliers' ? { data: [] } : rows.get(path.split('/')[1])); }, post(_path, value) { const row = { ...value, id: value.id ?? 'new', status: 'ACTIVE' }; rows.set(row.id, row); return of(row); }, patch(path, value) { const id = path.split('/')[1], row = { ...rows.get(id), ...value }; rows.set(id, row); return of(row); } };
  const signal = initial => { let value = initial; const readValue = () => value; readValue.update = update => value = update(value); return readValue; };
  const target = { exports: {} };
  const js = ts.transpileModule(read('src/app/features/procurement/procurement.service.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText;
  new Function('exports', 'module', 'require', js)(target.exports, target, name => name === '@angular/core' ? { inject: () => api, signal, Injectable: () => value => value } : name === 'rxjs' ? require('rxjs') : { ApiClient: class {} });
  return new target.exports.ProcurementService();
}
test('proveedor recién creado queda disponible para todas las pantallas sin recargar listas', async () => { const service = supplierService(); await firstValueFrom(service.createSupplier({ legalName: 'Proveedor nuevo' })); assert.equal(service.cachedSupplier('new').legalName, 'Proveedor nuevo'); });
test('proveedor fuera de la lista inicial se resuelve desde el id de la factura, incluso inactivo', async () => { const service = supplierService(); assert.equal(service.cachedSupplier('existing'), undefined); await firstValueFrom(service.getSupplier('existing')); assert.equal(service.cachedSupplier('existing').legalName, 'Proveedor de factura histórica'); });
test('editar nombre actualiza el directorio compartido', async () => { const service = supplierService(); await firstValueFrom(service.getSupplier('existing')); await firstValueFrom(service.updateSupplier('existing', { legalName: 'Nombre actualizado' })); assert.equal(service.cachedSupplier('existing').legalName, 'Nombre actualizado'); });
test('calendario usa una capa superior ajustada al viewport, sin desplegable nativo oculto', () => { const source = read('src/app/shared/date-input.component.ts'); assert.match(source, /#calendar popover="auto"/); assert.match(source, /calendarPosition\(/); assert.doesNotMatch(source, /showPicker\(/); assert.doesNotMatch(source, /scrollIntoView\(/); });
test('ancla nativa no duplica validación del campo visible', () => assert.match(read('src/app/shared/field-validation.directive.ts'), /:not\(\[data-calendar-proxy\]\)/));
test('campos editables y filtros de moneda usan selector compartido', () => { for (const file of ['settings/settings.page.html', 'procurement/suppliers.page.html', 'imports/import-reports.page.html', 'procurement/accounts-payable.page.html']) assert.match(read('src/app/features/' + file), /app-currency-select/); });
test('selección y lista de facturas esperan la resolución de su proveedor', () => { const source = read('src/app/features/imports/imports.page.ts'); assert.match(source, /getPurchase\(id\)\.pipe\(switchMap\(invoice => this.withInvoiceSupplier\(invoice\)\)/); assert.match(source, /allowed \? this.withInvoiceSupplier\(invoice\)/); });
test('monedas de empresa y pagos se muestran como selectores bloqueados, no texto libre', () => { assert.match(read('src/app/features/procurement/purchases.page.html'), /<app-currency-select \[value\]="baseCurrency\(\)" \[disabled\]="true"/); assert.match(read('src/app/features/procurement/accounts-payable.page.html'), /<app-currency-select \[value\]="paymentCurrency" \[disabled\]="true"/); });
