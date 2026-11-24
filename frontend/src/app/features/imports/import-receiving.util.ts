import type { ReceivingFormRow, ReceiveImportRequest, LinkImportRequest, ReceivingSummary, ReceivingShipment } from './import-receiving.model';

export function quantityMillis(value: string): bigint {
  if (!/^\d{1,11}(\.\d{1,3})?$/.test(value)) throw new Error('Usa una cantidad válida, con un máximo de tres decimales.');
  const [whole, fraction = ''] = value.split('.'); return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
}
export function buildReceiveRequest(rows: ReceivingFormRow[], completeOperation: boolean, receivedDate: string, notes: string): ReceiveImportRequest {
  const lines: ReceiveImportRequest['lines'] = [];
  const totals = new Map<string, bigint>();
  for (const row of rows) {
    row.submittedIndex = -1;
    const amount = quantityMillis(row.quantity || '0'); if (amount === 0n) continue;
    if (!row.source.isReceivable || amount > quantityMillis(row.source.maxReceivableNow)) throw new Error(`La cantidad de «${row.source.description}» supera lo disponible para recibir.`);
    if (row.source.purchaseInvoiceLineId && row.source.invoicePendingReceivableQuantity !== null) {
      const total = (totals.get(row.source.purchaseInvoiceLineId) ?? 0n) + amount;
      if (total > quantityMillis(row.source.invoicePendingReceivableQuantity)) throw new Error(`Las cantidades de «${row.source.description}» superan juntas el saldo de la factura.`);
      totals.set(row.source.purchaseInvoiceLineId, total);
    }
    row.submittedIndex = lines.length;
    lines.push({ importShipmentLineId: row.source.importShipmentLineId, quantity: row.quantity, ...(row.locationId ? { locationId: row.locationId } : {}) });
  }
  if (!lines.length) throw new Error('Ingresa al menos una cantidad para recibir.');
  return { receivedDate, ...(notes.trim() ? { notes: notes.trim() } : {}), lines, completeOperation };
}
export function buildLinkRequest(rows: ReceivingFormRow[], completeOperation: boolean): LinkImportRequest {
  const links: LinkImportRequest['links'] = [];
  const totals = new Map<string, bigint>();
  for (const row of rows) {
    row.submittedIndex = -1;
    const amount = quantityMillis(row.quantity || '0'); if (amount === 0n) continue;
    const receipt = row.source.candidateReceiptLines.find(item => item.purchaseReceiptLineId === row.receiptLineId);
    if (!row.source.isReceivable || !receipt || amount > quantityMillis(receipt.availableToLinkQuantity) || amount > quantityMillis(row.source.pendingQuantity)) throw new Error(`Revisa la recepción y la cantidad de «${row.source.description}».`);
    const total = (totals.get(receipt.purchaseReceiptLineId) ?? 0n) + amount;
    if (total > quantityMillis(receipt.availableToLinkQuantity)) throw new Error('La suma vinculada supera la cantidad disponible de la recepción seleccionada.');
    totals.set(receipt.purchaseReceiptLineId, total);
    row.submittedIndex = links.length;
    links.push({ importShipmentLineId: row.source.importShipmentLineId, purchaseReceiptLineId: receipt.purchaseReceiptLineId, linkedQuantity: row.quantity });
  }
  if (!links.length) throw new Error('Selecciona una recepción existente e indica la cantidad a vincular.');
  return { links, completeOperation };
}

export function shipmentReceptionState(shipment: ReceivingShipment): string {
  const lines = shipment.lines.filter(line => line.isReceivable);
  if (shipment.status === 'CANCELLED') return 'Embarque anulado';
  if (!lines.length) return 'Sin mercadería por recibir';
  if (lines.every(line => quantityMillis(line.pendingQuantity) === 0n)) return 'Recepción completa';
  if (lines.every(line => quantityMillis(line.maxReceivableNow) === 0n) && lines.some(line => line.candidateReceiptLines.length > 0)) return 'Pendiente de vincular recepción';
  return lines.some(line => quantityMillis(line.linkedQuantity) > 0n) ? 'Recepción parcial' : 'Recepción pendiente';
}

/** Predict the post-submit close state; the server still decides atomically. */
export function completionBlock(summary: ReceivingSummary | null, shipmentId: string, rows: ReceivingFormRow[]): string | null {
  if (!summary || !summary.canReceive || summary.status !== 'IN_PROGRESS') return 'Actualiza la importación antes de completar.';
  for (const shipment of summary.shipments) {
    if (shipment.status === 'CANCELLED') continue;
    if (shipment.status !== 'ARRIVED') return 'Hay embarques que todavía no han arribado.';
    for (const line of shipment.lines.filter(line => line.isReceivable)) {
      let amount = 0n;
      try { if (shipment.importShipmentId === shipmentId) amount = quantityMillis(rows.find(row => row.source.importShipmentLineId === line.importShipmentLineId)?.quantity || '0'); }
      catch { return 'Revisa las cantidades ingresadas.'; }
      if (amount < quantityMillis(line.pendingQuantity)) return 'Quedaría mercadería pendiente. Registra una recepción parcial sin completar la importación.';
    }
  }
  return null;
}
