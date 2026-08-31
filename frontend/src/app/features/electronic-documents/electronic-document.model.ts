export type FiscalDocumentType = 'FACTURA' | 'BOLETA';
export type ElectronicDocumentStatus = 'CREATED' | 'SUBMITTED' | 'SUBMISSION_FAILED' | 'ACCEPTED' | 'REJECTED';
export interface FiscalSeries { id: string; documentType: FiscalDocumentType; series: string; currentNumber: number; active: boolean; createdAt: string; updatedAt: string; }
export interface ElectronicDocumentItem { lineNumber: number; productSku: string; description: string; unitCode: string; unitName: string; unitAbbreviation: string; quantity: string; unitPrice: string; lineTotal: string; }
export interface ElectronicDocumentListItem {
  id: string; saleId: string; saleNumber: string; documentType: FiscalDocumentType; series: string; number: number; fullNumber: string;
  status: ElectronicDocumentStatus; currencyCode: string; customerDocumentType: string | null; customerDocumentNumber: string | null; customerName: string;
  subtotal: string; discountAmount: string; taxableBase: string; taxAmount: string; total: string; providerCode: string; providerStatus: string | null;
  issuedAt: string; lastSubmittedAt: string | null; acceptedAt: string | null; rejectedAt: string | null; createdAt: string; updatedAt: string;
}
export interface ElectronicDocument extends ElectronicDocumentListItem {
  issuerTaxId: string; issuerBusinessName: string; issuerAddress: string | null; customerAddress: string | null;
  providerMessage: string | null; submissionCount: number; items: ElectronicDocumentItem[];
}
export interface ElectronicDocumentQuery { page: number; limit: number; documentType?: FiscalDocumentType; status?: ElectronicDocumentStatus; series?: string; saleId?: string; customerDocumentNumber?: string; issuedFrom?: string; issuedTo?: string; }
