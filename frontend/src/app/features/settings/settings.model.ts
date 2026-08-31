export interface CompanySettings {
  id: string;
  businessName: string;
  tradeName: string | null;
  taxId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currencyCode: string;
  currencySymbol: string;
  taxEnabled: boolean;
  taxRate: string;
  quoteValidityDays: number;
  maxDiscountPercent: string;
  createdAt: string;
  updatedAt: string;
}

export type UpdateCompanySettings = Omit<CompanySettings, 'id' | 'createdAt' | 'updatedAt'>;
export type DocumentType = 'QUOTE' | 'SALE';

export interface DocumentSequence {
  id: string;
  documentType: DocumentType;
  prefix: string;
  padding: number;
  currentNumber: number;
  updatedAt: string;
}

export interface UpdateDocumentSequence {
  prefix: string;
  padding: number;
  currentNumber: number;
}
