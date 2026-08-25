export type DashboardQuoteStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED';

export interface DashboardPeriod {
  from: string;
  to: string;
}

export interface DashboardAmountSection {
  count: number;
  total: string;
}

export interface DashboardLowStockItem {
  productId: string;
  sku: string;
  productName: string;
  stockCurrent: string;
  stockMinimum: string;
  difference: string;
}

export interface DashboardLowStockSection {
  count: number;
  items: DashboardLowStockItem[];
}

export interface DashboardQuotesSection {
  total: number;
  byStatus: Array<{ status: DashboardQuoteStatus; count: number }>;
}

export interface DashboardReceivableItem {
  saleId: string;
  saleNumber: string;
  customerId: string;
  customerName: string;
  confirmedAt: string;
  total: string;
  paidAmount: string;
  balanceDue: string;
  daysOutstanding: number;
}

export interface DashboardReceivablesSection {
  count: number;
  totalBalance: string;
  oldest: DashboardReceivableItem[];
}

export interface DashboardResponse {
  period: DashboardPeriod;
  sales: DashboardAmountSection | null;
  collections: DashboardAmountSection | null;
  lowStock: DashboardLowStockSection | null;
  quotes: DashboardQuotesSection | null;
  receivables: DashboardReceivablesSection | null;
}

export interface DashboardQuery {
  from?: string;
  to?: string;
}
