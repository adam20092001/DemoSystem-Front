import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, Observable, take } from 'rxjs';
import { saveDownload } from '../../core/http/file-download';
import { shortDate, money, requestErrorMessage } from '../commercial/commercial.util';
import { AccountingAccount, JournalReport, LedgerReport, TrialBalance } from './accounting.model';
import { AccountingService } from './accounting.service';

type ReportTab = 'journal' | 'ledger' | 'trial-balance';
@Component({ selector: 'app-accounting-reports', imports: [FormsModule], templateUrl: './accounting-reports.page.html', styleUrls: ['../commercial/commercial-page.shared.scss', './accounting.page.scss'], changeDetection: ChangeDetectionStrategy.OnPush })
export class AccountingReportsPage implements OnInit {
  private readonly api = inject(AccountingService); protected readonly tab = signal<ReportTab>('journal'); protected readonly accounts = signal<AccountingAccount[]>([]); protected readonly journal = signal<JournalReport | null>(null); protected readonly ledger = signal<LedgerReport | null>(null); protected readonly trial = signal<TrialBalance | null>(null); protected readonly loading = signal(false); protected readonly exporting = signal(false); protected readonly error = visibleErrorSignal();
  protected dateFrom = firstDay(); protected dateTo = today(); protected accountId = '';
  ngOnInit(): void { this.api.listAccounts().pipe(take(1)).subscribe({ next: accounts => { this.accounts.set(accounts); this.accountId = accounts[0]?.id ?? ''; this.load(); }, error: e => this.error.set(requestErrorMessage(e)) }); }
  protected switchTab(tab: ReportTab): void { this.tab.set(tab); this.load(); }
  protected load(event?: Event): void { event?.preventDefault(); if (this.tab() === 'ledger' && !this.accountId) return; this.loading.set(true); const query = { accountingDateFrom: this.dateFrom, accountingDateTo: this.dateTo, ...(this.tab() === 'ledger' ? { accountId: this.accountId, page: 1, limit: 100 } : this.tab() === 'journal' ? { page: 1, limit: 100 } : {}) }; const request: Observable<unknown> = this.tab() === 'journal' ? this.api.journalReport(query) : this.tab() === 'ledger' ? this.api.ledgerReport(query) : this.api.trialBalance(query); request.pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: value => { if (this.tab() === 'journal') this.journal.set(value as JournalReport); else if (this.tab() === 'ledger') this.ledger.set(value as LedgerReport); else this.trial.set(value as TrialBalance); }, error: e => this.error.set(requestErrorMessage(e)) }); }
  protected export(): void { if (this.tab() === 'ledger' && !this.accountId) return; const query = { accountingDateFrom: this.dateFrom, accountingDateTo: this.dateTo, ...(this.tab() === 'ledger' ? { accountId: this.accountId } : {}) }; this.exporting.set(true); this.api.exportReport(this.tab(), query).pipe(take(1), finalize(() => this.exporting.set(false))).subscribe({ next: blob => saveDownload(blob, `${this.tab()}-${this.dateFrom}-${this.dateTo}.xlsx`), error: e => this.error.set(requestErrorMessage(e)) }); }
  protected formatMoney(value: string | number): string { return money(value); } protected formatDate(value: string): string { return shortDate(value); }
}
function today(): string { return new Date().toISOString().slice(0, 10); }
function firstDay(): string { const value = new Date(); value.setDate(1); return value.toISOString().slice(0, 10); }
