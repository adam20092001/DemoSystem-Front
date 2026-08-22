import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import {
  dateTime,
  money,
  pageRange,
  requestErrorMessage,
} from '../commercial/commercial.util';
import {
  AccountingAccount,
  AccountingEntryDetail,
  AccountingEntryListItem,
  AccountingEventType,
  AccountingSourceType,
  AccountType,
} from './accounting.model';
import { AccountingService } from './accounting.service';

type AccountingTab = 'entries' | 'accounts';

@Component({
  selector: 'app-accounting',
  imports: [FormsModule],
  templateUrl: './accounting.page.html',
  styleUrls: [
    '../commercial/commercial-page.shared.scss',
    './accounting.page.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingPage implements OnInit {
  private readonly accounting = inject(AccountingService);

  protected readonly activeTab = signal<AccountingTab>('entries');
  protected readonly accounts = signal<AccountingAccount[]>([]);
  protected readonly entries =
    signal<PaginatedResponse<AccountingEntryListItem> | null>(null);
  protected readonly detail = signal<AccountingEntryDetail | null>(null);
  protected readonly loadingAccounts = signal(false);
  protected readonly loadingEntries = signal(false);
  protected readonly loadingDetail = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly sourceTypes: AccountingSourceType[] = ['SALE', 'PAYMENT'];
  protected readonly eventTypes: AccountingEventType[] = [
    'ORIGINAL',
    'REVERSAL',
  ];
  protected readonly pageSizes = [10, 20, 50];

  protected sourceType = '';
  protected eventType = '';
  protected postedFrom = '';
  protected postedTo = '';
  protected pageSize = 20;

  ngOnInit(): void {
    this.loadAccounts();
    this.loadEntries();
  }

  protected switchTab(tab: AccountingTab): void {
    this.activeTab.set(tab);
    this.error.set(null);
  }

  protected applyFilters(event: Event): void {
    event.preventDefault();
    this.loadEntries(1);
  }

  protected clearFilters(): void {
    this.sourceType = '';
    this.eventType = '';
    this.postedFrom = '';
    this.postedTo = '';
    this.loadEntries(1);
  }

  protected previousPage(): void {
    const page = this.entries()?.page ?? 1;
    if (page > 1) this.loadEntries(page - 1);
  }

  protected nextPage(): void {
    const result = this.entries();
    if (result && result.page < result.totalPages)
      this.loadEntries(result.page + 1);
  }

  protected openDetail(id: string): void {
    this.loadingDetail.set(true);
    this.error.set(null);
    this.accounting
      .getEntry(id)
      .pipe(
        take(1),
        finalize(() => this.loadingDetail.set(false)),
      )
      .subscribe({
        next: (entry) => this.detail.set(entry),
        error: (error) => this.error.set(requestErrorMessage(error)),
      });
  }

  protected sourceLabel(value: AccountingSourceType): string {
    return value === 'SALE' ? 'Venta' : 'Pago';
  }

  protected eventLabel(value: AccountingEventType): string {
    return value === 'ORIGINAL' ? 'Registro' : 'Reversión';
  }

  protected accountTypeLabel(value: AccountType): string {
    return {
      ASSET: 'Activo',
      LIABILITY: 'Pasivo',
      REVENUE: 'Ingreso',
      CONTRA_REVENUE: 'Descuento sobre ventas',
    }[value];
  }

  protected formatDate(value: string): string {
    return dateTime(value);
  }

  protected formatMoney(value: string | number): string {
    return money(value);
  }

  protected isPositive(value: string): boolean {
    return Number(value) > 0;
  }

  protected range(): string {
    return pageRange(this.entries());
  }

  protected visibleEventCount(type: AccountingEventType): number {
    return (
      this.entries()?.data.filter((entry) => entry.eventType === type).length ??
      0
    );
  }

  protected detailDebit(): number {
    return (
      this.detail()?.lines.reduce(
        (total, line) => total + Number(line.debitAmount),
        0,
      ) ?? 0
    );
  }

  protected detailCredit(): number {
    return (
      this.detail()?.lines.reduce(
        (total, line) => total + Number(line.creditAmount),
        0,
      ) ?? 0
    );
  }

  protected loadAccounts(): void {
    this.loadingAccounts.set(true);
    this.error.set(null);
    this.accounting
      .listAccounts()
      .pipe(
        take(1),
        finalize(() => this.loadingAccounts.set(false)),
      )
      .subscribe({
        next: (accounts) => this.accounts.set(accounts),
        error: (error) => this.error.set(requestErrorMessage(error)),
      });
  }

  protected loadEntries(page = 1): void {
    this.loadingEntries.set(true);
    this.error.set(null);
    this.accounting
      .listEntries({
        page,
        limit: this.pageSize,
        ...(this.sourceType
          ? { sourceType: this.sourceType as AccountingSourceType }
          : {}),
        ...(this.eventType
          ? { eventType: this.eventType as AccountingEventType }
          : {}),
        ...(this.postedFrom ? { postedFrom: this.postedFrom } : {}),
        ...(this.postedTo ? { postedTo: this.postedTo } : {}),
      })
      .pipe(
        take(1),
        finalize(() => this.loadingEntries.set(false)),
      )
      .subscribe({
        next: (entries) => this.entries.set(entries),
        error: (error) => this.error.set(requestErrorMessage(error)),
      });
  }
}
