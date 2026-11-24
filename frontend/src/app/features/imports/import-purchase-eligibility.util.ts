import type { PurchaseInvoice, PurchaseReceiptsSummary } from '../procurement/procurement.model';
import type { ImportInvoiceLine } from './imports.model';

/** "Complete" refers to received/assigned goods, not whether the supplier was paid. */
export function purchaseCanStartImport(invoice: PurchaseInvoice, receipts: PurchaseReceiptsSummary | null, availability?: ImportInvoiceLine[] | null): boolean {
  if (invoice.status === 'CANCELLED') return false;
  if (invoice.status === 'DRAFT') return invoice.lines.length > 0;
  if (!receipts || receipts.purchaseInvoiceId !== invoice.id) return false;
  return receipts.lines.some(line => Number(line.pendingQuantity) > 0
    && invoice.lines.some(item => item.id === line.purchaseInvoiceLineId && item.isReceiptEligible === true)
    && (availability === undefined || !!availability?.some(item => item.purchaseInvoiceLineId === line.purchaseInvoiceLineId && Number(item.availableQuantity) > 0)));
}
