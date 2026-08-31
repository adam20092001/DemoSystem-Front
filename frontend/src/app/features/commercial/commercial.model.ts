export type CustomerType = 'PERSON' | 'COMPANY';
export type CustomerStage = 'PROSPECT' | 'CUSTOMER';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
export type CustomerDocumentType = 'DNI' | 'RUC' | 'CE' | 'PASSPORT' | 'OTHER';

export interface Customer {
  id: string;
  code: string | null;
  customerType: CustomerType | null;
  customerStage: CustomerStage;
  documentType: CustomerDocumentType | null;
  documentNumber: string | null;
  name: string;
  tradeName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  internalNotes: string | null;
  isGeneric: boolean;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ListCustomersQuery {
  page: number;
  limit: number;
  search?: string;
  status?: CustomerStatus;
  customerType?: CustomerType;
  customerStage?: CustomerStage;
  documentType?: CustomerDocumentType;
  isGeneric?: boolean;
}

export interface CreateCustomerRequest {
  customerType: CustomerType;
  customerStage: CustomerStage;
  name: string;
  documentType?: CustomerDocumentType;
  documentNumber?: string;
  tradeName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  internalNotes?: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  documentType?: CustomerDocumentType | null;
  documentNumber?: string | null;
  tradeName?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  internalNotes?: string | null;
}

export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';

export interface CommercialUserSummary {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
}

export interface QuoteListItem {
  id: string;
  number: string;
  status: QuoteStatus;
  customerId: string;
  customerName: string;
  customerDocumentNumber: string | null;
  sellerId: string;
  issueDate: string;
  expirationDate: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  currencyCode: string;
  taxEnabled: boolean;
  taxRate: string;
  total: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  unitCode: string;
  unitName: string;
  unitAbbreviation: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  stockInfo: {
    currentStock: string;
    requestedQuantity: string;
    sufficient: boolean;
  } | null;
}

export interface QuoteDetail extends QuoteListItem {
  customerType: CustomerType;
  customerDocumentType: CustomerDocumentType | null;
  customerName: string;
  customerAddress: string | null;
  seller: CommercialUserSummary;
  notes: string | null;
  items: QuoteItem[];
}

export interface QuoteLineRequest {
  productId: string;
  quantity: string;
}

export interface CreateQuoteRequest {
  customerId: string;
  expirationDate?: string;
  discountAmount?: string;
  notes?: string;
  items: QuoteLineRequest[];
}

export interface UpdateQuoteRequest {
  expirationDate?: string;
  discountAmount?: string;
  notes?: string;
  items?: QuoteLineRequest[];
}

export interface ListQuotesQuery {
  page: number;
  limit: number;
  search?: string;
  status?: QuoteStatus;
  customerId?: string;
  sellerId?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  expirationDateFrom?: string;
  expirationDateTo?: string;
}

export type SaleStatus = 'ACTIVE' | 'CANCELLED';
export type SalePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type SaleDeliveryStatus = 'NOT_APPLICABLE' | 'PENDING' | 'DELIVERED' | 'OBSERVED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'BANK_DEPOSIT' | 'CARD' | 'DIGITAL_WALLET' | 'OTHER';
export type PaymentStatus = 'ACTIVE' | 'CANCELLED';
export type PaymentCancellationSource = 'MANUAL' | 'SALE_CANCELLATION';

export interface PaymentRequest {
  method: PaymentMethod;
  amount: string;
  reference?: string;
}

export interface Payment {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amount: string;
  reference: string | null;
  status: PaymentStatus;
  paidAt: string;
  createdBy: CommercialUserSummary;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancellationSource: PaymentCancellationSource | null;
  cancelledBy: CommercialUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaleListItem {
  id: string;
  number: string;
  status: SaleStatus;
  paymentStatus: SalePaymentStatus;
  deliveryStatus: SaleDeliveryStatus;
  customerId: string;
  customerName: string;
  customerDocumentNumber: string | null;
  sellerId: string;
  seller: CommercialUserSummary;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  currencyCode: string;
  taxEnabled: boolean;
  taxRate: string;
  total: string;
  paidAmount: string;
  balanceDue: string;
  itemCount: number;
  confirmedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  unitCode: string;
  unitName: string;
  unitAbbreviation: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

export interface SaleInventoryMovement {
  id: string;
  productId: string;
  movementType: 'ENTRY' | 'EXIT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  origin: string;
  quantity: string;
  previousStock: string;
  newStock: string;
  createdAt: string;
}

export interface SaleDetail extends SaleListItem {
  customerIsGeneric: boolean;
  customerType: CustomerType | null;
  customerDocumentType: CustomerDocumentType | null;
  customerAddress: string | null;
  seller: CommercialUserSummary;
  quote: { id: string; number: string } | null;
  items: SaleItem[];
  inventoryMovements: SaleInventoryMovement[];
  payments: Payment[];
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancelledBy: CommercialUserSummary | null;
}

export interface CreateSaleRequest {
  customerId: string;
  discountAmount?: string;
  items: QuoteLineRequest[];
  payment?: PaymentRequest;
}

export interface ListSalesQuery {
  page: number;
  limit: number;
  search?: string;
  status?: SaleStatus;
  paymentStatus?: SalePaymentStatus;
  deliveryStatus?: SaleDeliveryStatus;
  customerId?: string;
  sellerId?: string;
  quoteId?: string;
  confirmedFrom?: string;
  confirmedTo?: string;
}

export interface PaymentRegistrationResult {
  payment: Payment;
  sale: {
    id: string;
    number: string;
    status: SaleStatus;
    total: string;
    paidAmount: string;
    balanceDue: string;
    paymentStatus: SalePaymentStatus;
  };
}

export interface ListPaymentsQuery {
  page: number;
  limit: number;
  method?: PaymentMethod;
  status?: PaymentStatus;
  createdByUserId?: string;
  paidFrom?: string;
  paidTo?: string;
}

export interface ReceivableItem {
  saleId: string;
  saleNumber: string;
  customerId: string;
  customerName: string;
  customerDocumentNumber: string | null;
  sellerId: string;
  confirmedAt: string;
  total: string;
  paidAmount: string;
  balanceDue: string;
  paymentStatus: SalePaymentStatus;
  daysOutstanding: number;
}

export interface ListReceivablesQuery {
  page: number;
  limit: number;
  customerId?: string;
  sellerId?: string;
  confirmedFrom?: string;
  confirmedTo?: string;
}
