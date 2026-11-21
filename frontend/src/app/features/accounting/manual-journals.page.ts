import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { shortDate, money, requestErrorMessage } from '../commercial/commercial.util';
import { AccountingAccount, ManualJournalDraft, ManualJournalLine } from './accounting.model';
import { AccountingService } from './accounting.service';

@Component({ selector: 'app-manual-journals', imports: [FormsModule], templateUrl: './manual-journals.page.html', styleUrls: ['../commercial/commercial-page.shared.scss', './accounting.page.scss'], changeDetection: ChangeDetectionStrategy.OnPush })
export class ManualJournalsPage implements OnInit {
  private readonly api = inject(AccountingService); protected readonly auth = inject(AuthService);
  protected readonly canWrite = computed(() => ['ADMIN', 'ACCOUNTANT'].includes(this.auth.role()));
  protected readonly result = signal<PaginatedResponse<ManualJournalDraft> | null>(null); protected readonly accounts = signal<AccountingAccount[]>([]); protected readonly loading = signal(false); protected readonly error = visibleErrorSignal(); protected readonly notice = signal<string | null>(null); protected readonly formOpen = signal(false); protected readonly editing = signal<ManualJournalDraft | null>(null);
  protected status = ''; protected accountingDate = today(); protected description = ''; protected lines: ManualJournalLine[] = [emptyLine()];
  ngOnInit(): void { forkJoin({ accounts: this.api.listChartAccounts({ page: 1, limit: 100, status: 'ACTIVE', isPostable: true }), drafts: this.api.listManualJournals({ page: 1, limit: 20 }) }).pipe(take(1)).subscribe({ next: ({ accounts, drafts }) => { this.accounts.set(accounts.data); this.result.set(drafts); }, error: e => this.error.set(requestErrorMessage(e)) }); }
  protected load(page = 1): void { this.loading.set(true); this.api.listManualJournals({ page, limit: 20, status: this.status }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: value => this.result.set(value), error: e => this.error.set(requestErrorMessage(e)) }); }
  protected openCreate(): void { this.editing.set(null); this.accountingDate = today(); this.description = ''; this.lines = [emptyLine()]; this.formOpen.set(true); }
  protected openEdit(item: ManualJournalDraft): void { this.editing.set(item); this.accountingDate = item.accountingDate; this.description = item.description; this.lines = item.lines.map(line => ({ accountId: line.accountId, debitAmount: line.debitAmount, creditAmount: line.creditAmount })); this.formOpen.set(true); }
  protected addLine(): void { this.lines.push(emptyLine()); }
  protected removeLine(index: number): void { this.lines.splice(index, 1); if (!this.lines.length) this.lines.push(emptyLine()); }
  protected debitTotal(): number { return this.lines.reduce((sum, line) => sum + Number(line.debitAmount || 0), 0); }
  protected creditTotal(): number { return this.lines.reduce((sum, line) => sum + Number(line.creditAmount || 0), 0); }
  protected save(): void {
    if (!this.description.trim() || !this.accountingDate) { this.error.set('Fecha y descripción son obligatorias.'); return; }
    const body = { accountingDate: this.accountingDate, description: this.description.trim(), lines: this.lines.map(line => ({ accountId: line.accountId, debitAmount: Number(line.debitAmount || 0).toFixed(2), creditAmount: Number(line.creditAmount || 0).toFixed(2) })) };
    this.loading.set(true); const request = this.editing() ? this.api.updateManualJournal(this.editing()!.id, body) : this.api.createManualJournal(body);
    request.pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: () => { this.formOpen.set(false); this.notice.set('Borrador guardado.'); this.load(); }, error: e => this.error.set(requestErrorMessage(e)) });
  }
  protected post(item: ManualJournalDraft): void { if (!confirm('¿Contabilizar este asiento? Ya no podrá editarse.')) return; this.api.postManualJournal(item.id).pipe(take(1)).subscribe({ next: () => { this.notice.set('Asiento contabilizado.'); this.load(); }, error: e => this.error.set(requestErrorMessage(e)) }); }
  protected reverse(item: ManualJournalDraft): void { const reason = prompt('Motivo de la reversión:')?.trim(); if (!reason) return; this.api.reverseManualJournal(item.id, reason).pipe(take(1)).subscribe({ next: () => { this.notice.set('Asiento revertido.'); this.load(); }, error: e => this.error.set(requestErrorMessage(e)) }); }
  protected accountLabel(id: string): string { const account = this.accounts().find(item => item.id === id); return account ? `${account.code} · ${account.name}` : id; }
  protected formatMoney(value: string | number): string { return money(value); } protected formatDate(value: string): string { return shortDate(value); }
}
function today(): string { return new Date().toISOString().slice(0, 10); }
function emptyLine(): ManualJournalLine { return { accountId: '', debitAmount: '0.00', creditAmount: '0.00' }; }
