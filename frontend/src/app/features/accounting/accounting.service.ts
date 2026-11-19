import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import {
  AccountingAccount,
  AccountingEntryDetail,
  AccountingEntryListItem,
  AccountingPeriod,
  ChartAccount,
  JournalReport,
  LedgerReport,
  ListAccountingEntriesQuery,
  ManualJournalDraft,
  TrialBalance,
} from './accounting.model';

@Injectable({ providedIn: 'root' })
export class AccountingService {
  private readonly api = inject(ApiClient);

  listAccounts(): Observable<AccountingAccount[]> {
    return this.api.get<AccountingAccount[]>('accounts');
  }

  listChartAccounts(query: object): Observable<PaginatedResponse<ChartAccount>> { return this.api.get('chart-of-accounts', queryParams(query)); }
  createChartAccount(body: { code: string; name: string; type: string; parentId?: string; isPostable?: boolean }): Observable<ChartAccount> { return this.api.post('chart-of-accounts', body); }
  updateChartAccount(id: string, body: { name?: string; type?: string; parentId?: string | null; isPostable?: boolean }): Observable<ChartAccount> { return this.api.patch(`chart-of-accounts/${id}`, body); }
  setChartAccountActive(id: string, active: boolean): Observable<ChartAccount> { return this.api.post(`chart-of-accounts/${id}/${active ? 'activate' : 'deactivate'}`, {}); }
  assignSystemKey(systemKey: string, accountId: string): Observable<ChartAccount> { return this.api.patch(`chart-of-accounts/system-keys/${systemKey}`, { accountId }); }

  listEntries(
    query: ListAccountingEntriesQuery,
  ): Observable<PaginatedResponse<AccountingEntryListItem>> {
    return this.api.get<PaginatedResponse<AccountingEntryListItem>>(
      'accounting/entries',
      queryParams(query),
    );
  }

  getEntry(id: string): Observable<AccountingEntryDetail> {
    return this.api.get<AccountingEntryDetail>(`accounting/entries/${id}`);
  }

  listPeriods(query: object): Observable<PaginatedResponse<AccountingPeriod>> { return this.api.get('accounting/periods', queryParams(query)); }
  createPeriod(year: number, month: number): Observable<AccountingPeriod> { return this.api.post('accounting/periods', { year, month }); }
  changePeriodStatus(id: string, action: 'close' | 'reopen'): Observable<AccountingPeriod> { return this.api.post(`accounting/periods/${id}/${action}`, {}); }

  listManualJournals(query: object): Observable<PaginatedResponse<ManualJournalDraft>> { return this.api.get('accounting/manual-entries', queryParams(query)); }
  getManualJournal(id: string): Observable<ManualJournalDraft> { return this.api.get(`accounting/manual-entries/${id}`); }
  createManualJournal(body: { accountingDate: string; description: string; lines: Array<{ accountId: string; debitAmount: string; creditAmount: string }> }): Observable<ManualJournalDraft> { return this.api.post('accounting/manual-entries', body); }
  updateManualJournal(id: string, body: object): Observable<ManualJournalDraft> { return this.api.patch(`accounting/manual-entries/${id}`, body); }
  postManualJournal(id: string): Observable<ManualJournalDraft> { return this.api.post(`accounting/manual-entries/${id}/post`, {}); }
  reverseManualJournal(id: string, reason: string): Observable<ManualJournalDraft> { return this.api.post(`accounting/manual-entries/${id}/reverse`, { reason }); }

  journalReport(query: object): Observable<JournalReport> { return this.api.get('accounting/reports/journal', queryParams(query)); }
  ledgerReport(query: object): Observable<LedgerReport> { return this.api.get('accounting/reports/ledger', queryParams(query)); }
  trialBalance(query: object): Observable<TrialBalance> { return this.api.get('accounting/reports/trial-balance', queryParams(query)); }
  exportReport(kind: 'journal' | 'ledger' | 'trial-balance', query: object): Observable<Blob> { return this.api.download(`accounting/reports/${kind}/export.xlsx`, queryParams(query)); }
}

function queryParams(query: object): QueryParams {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ) as QueryParams;
}
