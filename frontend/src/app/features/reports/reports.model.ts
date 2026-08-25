import {
  CustomerType,
  PaymentMethod,
  PaymentStatus,
  QuoteStatus,
} from '../commercial/commercial.model';

export type ReportKind =
  | 'sales-by-product'
  | 'sales-by-customer'
  | 'sales-by-seller'
  | 'quotes-by-status'
  | 'payments-by-method';

export interface ReportDateRangeQuery {
  page: number;
  limit: number;
  from?: string;
  to?: string;
}

export interface SalesByProductQuery extends ReportDateRangeQuery {
  categoryId?: string;
  productId?: string;
}

export interface SalesByCustomerQuery extends ReportDateRangeQuery {
  customerId?: string;
  customerType?: CustomerType;
}

export interface SalesBySellerQuery extends ReportDateRangeQuery {
  sellerId?: string;
}

export interface QuotesByStatusQuery extends ReportDateRangeQuery {
  status?: QuoteStatus;
  sellerId?: string;
  customerId?: string;
}

export interface PaymentsByMethodQuery extends ReportDateRangeQuery {
  method?: PaymentMethod;
  status?: PaymentStatus;
  createdByUserId?: string;
}

export interface ReportUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
}

export interface SalesByProductRow {
  productId: string;
  sku: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  quantitySold: string;
  totalSold: string;
}

export interface SalesByCustomerRow {
  customerId: string;
  customerName: string;
  customerDocumentNumber: string | null;
  customerType: CustomerType | null;
  saleCount: number;
  totalSold: string;
  totalPaid: string;
  balance: string;
}

export interface SalesBySellerRow {
  seller: ReportUser;
  saleCount: number;
  totalSold: string;
  totalCollected: string;
  convertedQuotes: number;
}

export interface QuotesByStatusRow {
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  total: string;
  status: QuoteStatus;
  resultingSale: { saleId: string; saleNumber: string } | null;
}

export interface PaymentsByMethodRow {
  paidAt: string;
  paymentId: string;
  saleId: string;
  saleNumber: string;
  customerName: string;
  method: PaymentMethod;
  reference: string | null;
  amount: string;
  status: PaymentStatus;
  createdBy: ReportUser;
}

export type ReportRow =
  | SalesByProductRow
  | SalesByCustomerRow
  | SalesBySellerRow
  | QuotesByStatusRow
  | PaymentsByMethodRow;
