export type SupplierDocumentType = 'RUC' | 'DNI' | 'FOREIGN_TAX_ID' | 'OTHER';
export type SupplierStatus = 'ACTIVE' | 'INACTIVE';

export interface Supplier {
  id: string;
  documentType: SupplierDocumentType;
  documentNumber: string;
  countryCode: string;
  legalName: string;
  tradeName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  internalNotes: string | null;
  defaultCurrencyCode: string | null;
  status: SupplierStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SaveSupplierRequest {
  documentType: SupplierDocumentType;
  documentNumber: string;
  countryCode?: string;
  legalName: string;
  tradeName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  internalNotes?: string;
  defaultCurrencyCode?: string;
}

export type PurchaseInvoiceDocumentType = 'FACTURA' | 'BOLETA' | 'RECIBO' | 'OTHER';
export type PurchaseInvoiceStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type PurchaseAcquisitionKind = 'GOOD' | 'SERVICE' | 'OTHER';
export type PurchasePurpose = 'RESALE_INVENTORY' | 'INTERNAL_CONSUMPTION' | 'FIXED_ASSET' | 'OPERATING_EXPENSE' | 'OTHER';
export type PurchaseLineTaxCategory = 'TAXED' | 'EXEMPT' | 'UNAFFECTED' | 'OTHER';
export type PurchaseLineTaxBasis = 'TAX_INCLUDED' | 'TAX_EXCLUDED';

export interface PurchaseInvoiceLineRequest {
  productId?: string;
  description?: string;
  unitLabel?: string;
  acquisitionKind: PurchaseAcquisitionKind;
  purchasePurpose: PurchasePurpose;
  quantity: string;
  unitCost: string;
  taxCategory: PurchaseLineTaxCategory;
  taxBasis?: PurchaseLineTaxBasis;
  creditableTaxAmount?: string;
}

export interface SavePurchaseInvoiceRequest {
  supplierId: string;
  documentType: PurchaseInvoiceDocumentType;
  documentSeries?: string;
  documentNumber: string;
  issueDate: string;
  registrationDate?: string;
  accountingDate?: string;
  dueDate?: string;
  paymentTermsDays?: number;
  lines?: PurchaseInvoiceLineRequest[];
}

export interface PurchaseInvoiceLine extends PurchaseInvoiceLineRequest {
  id: string;
  descriptionSnapshot: string;
  unitCodeSnapshot: string | null;
  unitNameSnapshot: string | null;
  taxRateSnapshot: string | null;
  taxableBaseAmount: string;
  taxAmount: string;
  creditableTaxAmount: string;
  lineTotal: string;
  isReceiptEligible: boolean | null;
}

export interface PurchaseInvoice {
  id: string;
  supplierId: string;
  documentType: PurchaseInvoiceDocumentType;
  documentSeries: string | null;
  documentNumber: string;
  issueDate: string;
  registrationDate: string;
  accountingDate: string;
  dueDate: string | null;
  paymentTermsDays: number | null;
  currencyCode: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  status: PurchaseInvoiceStatus;
  postedEntryId: string | null;
  createdByUserId: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseInvoiceLine[];
}

export interface PurchaseReceiptLine {
  id: string;
  purchaseInvoiceLineId: string;
  quantity: string;
  reclassifiedAmount: string | null;
}

export interface PurchaseReceipt {
  id: string;
  purchaseInvoiceId: string;
  receivedDate: string;
  status: 'ACTIVE' | 'CANCELLED';
  notes: string | null;
  cancellationReason: string | null;
  createdAt: string;
  lines: PurchaseReceiptLine[];
}

export interface ReceiptLineSummary {
  purchaseInvoiceLineId: string;
  invoicedQuantity: string;
  receivedQuantity: string;
  pendingQuantity: string;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETE';
}

export interface PurchaseReceiptsSummary {
  purchaseInvoiceId: string;
  receipts: PurchaseReceipt[];
  lines: ReceiptLineSummary[];
}

export type PayableStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type AgingBucket = 'NOT_OVERDUE' | 'OVERDUE_1_30' | 'OVERDUE_31_60' | 'OVERDUE_61_90' | 'OVERDUE_90_PLUS' | 'NO_DUE_DATE';

export interface AccountPayable {
  purchaseInvoiceId: string;
  supplierId: string;
  supplierLegalName: string;
  supplierDocumentNumber: string;
  documentType: PurchaseInvoiceDocumentType;
  documentSeries: string | null;
  documentNumber: string;
  issueDate: string;
  dueDate: string | null;
  currencyCode: string;
  originalAmount: string;
  paidAmount: string;
  balanceDue: string;
  status: PayableStatus;
  agingBucket: AgingBucket;
  daysOverdue: number | null;
}

export interface PayablesSummary {
  bySupplier: Array<{ supplierId: string; supplierLegalName: string; supplierDocumentNumber: string; invoiceCount: number; totalOriginal: string; totalPaid: string; totalPending: string }>;
  grandTotal: { invoiceCount: number; totalOriginal: string; totalPaid: string; totalPending: string };
}

export interface AgingReport {
  asOfDate: string;
  totals: { totalPending: string; buckets: AgingBucketAmount[] };
  bySupplier: Array<{ supplierId: string; supplierLegalName: string; supplierDocumentNumber: string; totalPending: string; buckets: AgingBucketAmount[] }>;
  limitations: string[];
}

export interface AgingBucketAmount { bucket: AgingBucket; invoiceCount: number; amount: string; percentage: string }

export interface SupplierPayment {
  id: string;
  supplierId: string;
  paymentDate: string;
  amount: string;
  currencyCode: string;
  paymentMethodCode: string;
  paymentMethodName: string;
  reference: string | null;
  status: 'ACTIVE' | 'CANCELLED';
  cancellationReason: string | null;
  createdAt: string;
  allocations: Array<{ id: string; purchaseInvoiceId: string; amount: string }>;
}

export interface ReconciliationReport {
  generatedAt: string;
  overallConsistent: boolean;
  invoices: Array<{ purchaseInvoiceId: string; supplierId: string; originalAmount: string; operationalPaidAmount: string; operationalPendingBalance: string; discrepancies: string[] }>;
  accounts: Array<{ accountId: string; accountCode: string; accountName: string; operationalPaidAmount: string; accountingNetDebitAmount: string; difference: string; discrepancies: string[] }>;
  limitations: string[];
}
