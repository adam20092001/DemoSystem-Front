import type { ImportInvoiceLine } from './imports.model';

interface CargoLine { purchaseInvoiceLineId?: string | null; plannedQuantity: string }
export function shipmentLineIsLocked(invoiceLines: ImportInvoiceLine[] | null, original: CargoLine[], line: CargoLine): boolean {
  return !!line.purchaseInvoiceLineId && original.some(item => item.purchaseInvoiceLineId === line.purchaseInvoiceLineId)
    && invoiceLines?.some(item => item.purchaseInvoiceLineId === line.purchaseInvoiceLineId && Number(item.availableQuantity) <= 0) === true;
}
function amount(value: string): bigint | null {
  if (!/^\d{1,11}(\.\d{1,3})?$/.test(String(value))) return null;
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
}
function decimal(value: bigint): string { return `${value / 1000n}.${(value % 1000n).toString().padStart(3, '0')}`; }

/** Global available quantity already excludes all active shipments, including the one being edited. */
export function shipmentQuantityLimit(invoiceLines: ImportInvoiceLine[] | null, rows: CargoLine[], original: CargoLine[], index: number): string | null {
  const id = rows[index]?.purchaseInvoiceLineId;
  const invoice = invoiceLines?.find(line => line.purchaseInvoiceLineId === id);
  if (!invoice || !id) return null;
  let remaining = amount(invoice.availableQuantity) ?? 0n;
  // Return the persisted shipment's allocation once, not once per new form row.
  for (const line of original) if (line.purchaseInvoiceLineId === id) remaining += amount(line.plannedQuantity) ?? 0n;
  rows.forEach((line, other) => { if (other !== index && line.purchaseInvoiceLineId === id) remaining -= amount(line.plannedQuantity) ?? 0n; });
  return decimal(remaining > 0n ? remaining : 0n);
}

export function shipmentQuantityError(invoiceLines: ImportInvoiceLine[] | null, rows: CargoLine[], original: CargoLine[], index: number): string | null {
  const quantity = amount(rows[index]?.plannedQuantity ?? '');
  if (quantity === null || quantity <= 0n) return 'Ingresa una cantidad mayor a cero, con un máximo de tres decimales.';
  const limit = shipmentQuantityLimit(invoiceLines, rows, original, index);
  if (limit !== null && quantity > amount(limit)!) return 'La cantidad supera el saldo de la factura disponible para esta línea.';
  return null;
}
