export type AccountType = 'ASSET' | 'LIABILITY' | 'REVENUE' | 'CONTRA_REVENUE' | 'EQUITY' | 'EXPENSE' | 'COST';
export type AccountingSystemKey =
  | 'CASH'
  | 'BANK'
  | 'ACCOUNTS_RECEIVABLE'
  | 'VAT_PAYABLE'
  | 'SALES_REVENUE'
  | 'DISCOUNTS' | 'ACCOUNTS_PAYABLE' | 'VAT_RECEIVABLE' | 'PURCHASE_RESALE_INVENTORY'
  | 'PURCHASE_INTERNAL_CONSUMPTION' | 'PURCHASE_FIXED_ASSET' | 'PURCHASE_OPERATING_EXPENSE' | 'PURCHASE_OTHER'
  | 'COST_OF_GOODS_SOLD' | 'FX_GAIN_REALIZED' | 'FX_LOSS_REALIZED';
export type AccountingSourceType = 'SALE' | 'PAYMENT' | 'MANUAL' | 'PURCHASE' | 'PURCHASE_RECEIPT' | 'SUPPLIER_PAYMENT' | 'COGS';
export type AccountingEventType = 'ORIGINAL' | 'REVERSAL';

export interface AccountingAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  systemKey: AccountingSystemKey | null;
}
export interface ChartAccount extends AccountingAccount {
  parentId: string | null;
  level: number;
  isPostable: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  normalBalance: 'DEBIT' | 'CREDIT';
  createdAt: string;
  updatedAt: string;
}

export interface AccountingEntryListItem {
  id: string;
  sourceType: AccountingSourceType;
  sourceId: string;
  eventType: AccountingEventType;
  reversesEntryId: string | null;
  description: string;
  postedAt: string;
  createdAt: string;
  accountingDate: string;
  periodId: string;
  journalNumber: number;
}

export interface AccountingPeriod {
  id: string; year: number; month: number; status: 'OPEN' | 'CLOSED'; lastJournalNumber: number;
  closedAt: string | null; closedBy: AccountingEntryUser | null; reopenedAt: string | null; reopenedBy: AccountingEntryUser | null;
  createdAt: string; updatedAt: string;
}

export interface ManualJournalLine { id?: string; accountId: string; accountCode?: string; accountName?: string; debitAmount: string; creditAmount: string }
export interface ManualJournalDraft { id: string; accountingDate: string; description: string; status: 'DRAFT' | 'POSTED'; postedEntryId: string | null; createdByUserId: string; createdAt: string; updatedAt: string; lines: ManualJournalLine[] }

export interface JournalReport { data: Array<AccountingEntryListItem & { periodYear: number; periodMonth: number; totalDebit: string; totalCredit: string; lines: AccountingEntryLine[] }>; page: number; limit: number; total: number; totalPages: number; accountingDateFrom: string; accountingDateTo: string; periodId: string | null }
export interface LedgerReport { accountId: string; accountCode: string; accountName: string; accountType: AccountType; accountStatus: 'ACTIVE' | 'INACTIVE'; normalBalance: 'DEBIT' | 'CREDIT'; accountingDateFrom: string; accountingDateTo: string; openingBalance: string; closingBalance: string; data: Array<{ entryId: string; accountingDate: string; journalNumber: number; description: string; eventType: AccountingEventType; sourceType: string; debitAmount: string; creditAmount: string; runningBalance: string }>; page: number; limit: number; total: number; totalPages: number }
export interface TrialBalance { accountingDateFrom: string; accountingDateTo: string; data: Array<{ accountId: string; accountCode: string; accountName: string; accountType: AccountType; accountStatus: 'ACTIVE' | 'INACTIVE'; openingDebit: string; openingCredit: string; periodDebit: string; periodCredit: string; endingDebit: string; endingCredit: string }>; reconciliation: { applicable: boolean; openingBalanced: boolean | null; periodBalanced: boolean | null; endingBalanced: boolean | null; totalOpeningDebit: string; totalOpeningCredit: string; totalPeriodDebit: string; totalPeriodCredit: string; totalEndingDebit: string; totalEndingCredit: string } }

export interface AccountingEntryUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
}

export interface AccountingEntryLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debitAmount: string;
  creditAmount: string;
}

export interface AccountingEntryDetail extends AccountingEntryListItem {
  createdBy: AccountingEntryUser;
  lines: AccountingEntryLine[];
}

export interface ListAccountingEntriesQuery {
  page: number;
  limit: number;
  sourceType?: AccountingSourceType;
  eventType?: AccountingEventType;
  sourceId?: string;
  postedFrom?: string;
  postedTo?: string;
}
