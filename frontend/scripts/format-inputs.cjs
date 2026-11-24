// Mechanical, idempotent wiring of the shared date and money controls.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../src/app');
const changed = new Map();
function files(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(path.join(directory, item.name)) : [path.join(directory, item.name)]); }
const monetaryModels = new Set(['line.debitAmount', 'line.creditAmount', 'productForm.salePrice', 'registerAmount', 'line.discount', 'payment.amount', 'line.discountValue', 'paymentAmount', 'expenseForm.amount', 'allocationAmount', 'manualAmounts[line.id]', 'item.amount', 'line.unitCost', 'line.creditableTaxAmount']);
for (const file of files(root).filter(file => /\.(html|ts)$/.test(file) && !file.includes(path.sep + 'shared' + path.sep))) {
  const before = fs.readFileSync(file, 'utf8');
  let dates = 0, money = 0;
  const after = before.replace(/<input\b(?:[^>"']|"[^"]*"|'[^']*')*>/g, tag => {
    if (/type="date"/.test(tag)) {
      if (!/ngModel/.test(tag)) throw new Error('Date without model: ' + file);
      dates++;
      return tag.replace('<input', '<app-date-input ').replace(/\s*type="date"/, ' ').replace(/\s+class="[^"]*"/, '').replace(/\/?\s*>$/, '></app-date-input>');
    }
    const model = /\[\(ngModel\)\]="([^"]+)"/.exec(tag)?.[1];
    if (!model || !monetaryModels.has(model) || /appMoney/.test(tag)) return tag;
    money++;
    const marker = model === 'line.discountValue' ? '[appMoney]="line.discountType === \'FIXED\'"' : 'appMoney';
    const precision = model === 'line.unitCost' ? ' [moneyDecimals]="form.currencyCode === baseCurrency() ? 2 : 6"' : '';
    return tag.replace('<input', '<input ' + marker + precision).replace(/\s+pattern="[^"]*"/, '');
  });
  if (after === before) continue;
  fs.writeFileSync(file, after);
  const component = file.endsWith('.html') ? file.slice(0, -5) + '.ts' : file;
  const controls = changed.get(component) ?? new Set();
  if (dates) controls.add('DateInputComponent');
  if (money) controls.add('MoneyInputDirective');
  changed.set(component, controls);
  console.log(path.relative(root, file) + ': ' + dates + ' fechas, ' + money + ' importes');
}
for (const [file, controls] of changed) {
  let source = fs.readFileSync(file, 'utf8');
  for (const name of controls) {
    if (new RegExp('import.*\\b' + name + '\\b').test(source)) continue;
    const target = path.join(root, 'shared', name === 'DateInputComponent' ? 'date-input.component' : 'money-input.directive');
    let relative = path.relative(path.dirname(file), target).replace(/\\/g, '/');
    if (!relative.startsWith('.')) relative = './' + relative;
    source = `import { ${name} } from '${relative}';\n` + source;
    source = source.replace(/imports:\s*\[/, match => match + name + ', ');
  }
  fs.writeFileSync(file, source);
}
