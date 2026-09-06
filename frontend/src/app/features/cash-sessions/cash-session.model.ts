export type CashSessionStatus = 'OPEN' | 'PENDING_APPROVAL' | 'CLOSED';

export interface CashSessionMethodBreakdown {
  paymentMethodId: string;
  paymentMethodCode: string;
  paymentMethodName: string;
  totalAmount: string;
}

export interface CashSession {
  id: string;
  userId: string;
  status: CashSessionStatus;
  openingAmount: string;
  openedAt: string;
  closeRequestedAt: string | null;
  expectedCashAmount: string | null;
  countedCashAmount: string | null;
  differenceAmount: string | null;
  closingObservation: string | null;
  closedAt: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  approvalComment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CashSessionDetail extends CashSession {
  liveCollectionsTotal: string | null;
  liveCashCollectionsTotal: string | null;
  liveExpectedCashAmount: string | null;
  liveBreakdownByMethod: CashSessionMethodBreakdown[] | null;
  breakdownByMethod: CashSessionMethodBreakdown[] | null;
}

export interface ListCashSessionsQuery {
  page: number;
  limit: number;
  userId?: string;
  status?: CashSessionStatus;
  openedFrom?: string;
  openedTo?: string;
  closedFrom?: string;
  closedTo?: string;
  hasDifference?: boolean;
}
