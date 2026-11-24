import type { PurchaseInvoice, PurchaseReceiptsSummary } from './procurement.model';

export function pendingReceiptLines(invoice: PurchaseInvoice | null, summary: PurchaseReceiptsSummary | null) {
  if (!invoice || !summary || summary.purchaseInvoiceId !== invoice.id) return [];
  return summary.lines.filter(line => invoice.lines.some(item => item.id === line.purchaseInvoiceLineId && item.isReceiptEligible === true) && Number(line.pendingQuantity) > 0);
}

export function purchaseReceptionState(invoice: PurchaseInvoice | null, summary: PurchaseReceiptsSummary | null): string {
  if (!invoice || !summary || summary.purchaseInvoiceId !== invoice.id) return '';
  const lines = summary.lines.filter(line => invoice.lines.some(item => item.id === line.purchaseInvoiceLineId && item.isReceiptEligible === true));
  if (!lines.length) return 'Sin mercadería por recibir';
  if (lines.every(line => Number(line.pendingQuantity) <= 0)) return 'Recepción completa';
  return lines.some(line => Number(line.receivedQuantity) > 0) ? 'Recepción parcial' : 'Recepción pendiente';
}

export function purchaseReceiptLines(invoice: PurchaseInvoice, summary: PurchaseReceiptsSummary, quantities: Record<string, string>, locations: Record<string, string>) {
  const pending = pendingReceiptLines(invoice, summary);
  const lines: Array<{ purchaseInvoiceLineId: string; quantity: string; locationId?: string }> = [];
  for (const [id, raw] of Object.entries(quantities)) {
    const value = String(raw ?? '').trim() || '0';
    if (!/^\d{1,11}(\.\d{1,3})?$/.test(value)) throw new Error('Usa cantidades positivas con un máximo de tres decimales.');
    if (Number(value) === 0) continue;
    const line = pending.find(item => item.purchaseInvoiceLineId === id);
    if (!line || Number(value) > Number(line.pendingQuantity)) throw new Error('La cantidad a recibir supera el saldo pendiente. Actualiza la compra y revisa las cantidades.');
    lines.push({ purchaseInvoiceLineId: id, quantity: value, ...(locations[id] ? { locationId: locations[id] } : {}) });
  }
  if (!lines.length) throw new Error('Ingresa al menos una cantidad pendiente de recibir.');
  return lines;
}
