export type AccountType = 'ASSET' | 'LIABILITY' | 'REVENUE' | 'CONTRA_REVENUE';
export type AccountingSystemKey =
  | 'CASH'
  | 'BANK'
  | 'ACCOUNTS_RECEIVABLE'
  | 'VAT_PAYABLE'
  | 'SALES_REVENUE'
  | 'DISCOUNTS';
export type AccountingSourceType = 'SALE' | 'PAYMENT';
export type AccountingEventType = 'ORIGINAL' | 'REVERSAL';

export interface AccountingAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  systemKey: AccountingSystemKey;
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
}

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
