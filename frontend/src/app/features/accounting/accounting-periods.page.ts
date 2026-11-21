import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { dateTime, requestErrorMessage } from '../commercial/commercial.util';
import { AccountingPeriod } from './accounting.model';
import { AccountingService } from './accounting.service';

@Component({ selector: 'app-accounting-periods', imports: [FormsModule, TitleCasePipe], templateUrl: './accounting-periods.page.html', styleUrls: ['../commercial/commercial-page.shared.scss', './accounting.page.scss'], changeDetection: ChangeDetectionStrategy.OnPush })
export class AccountingPeriodsPage implements OnInit {
  private readonly api = inject(AccountingService); protected readonly auth = inject(AuthService);
  protected readonly canWrite = computed(() => this.auth.role() === 'ADMIN');
  protected readonly result = signal<PaginatedResponse<AccountingPeriod> | null>(null); protected readonly loading = signal(false); protected readonly error = visibleErrorSignal(); protected readonly notice = signal<string | null>(null);
  protected year: number | undefined; protected status = ''; protected createYear = new Date().getFullYear(); protected createMonth = new Date().getMonth() + 1; protected readonly createOpen = signal(false);
  ngOnInit(): void { this.load(); }
  protected load(page = 1): void { this.loading.set(true); this.api.listPeriods({ page, limit: 20, year: this.year, status: this.status }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: value => this.result.set(value), error: e => this.error.set(requestErrorMessage(e)) }); }
  protected apply(e: Event): void { e.preventDefault(); this.load(); }
  protected create(): void { this.loading.set(true); this.api.createPeriod(this.createYear, this.createMonth).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: () => { this.createOpen.set(false); this.notice.set('Periodo abierto.'); this.load(); }, error: e => this.error.set(requestErrorMessage(e)) }); }
  protected change(item: AccountingPeriod): void { const action = item.status === 'OPEN' ? 'close' : 'reopen'; if (!confirm(`¿${action === 'close' ? 'Cerrar' : 'Reabrir'} el periodo ${this.monthName(item.month)} ${item.year}?`)) return; this.api.changePeriodStatus(item.id, action).pipe(take(1)).subscribe({ next: () => { this.notice.set(action === 'close' ? 'Periodo cerrado.' : 'Periodo reabierto.'); this.load(); }, error: e => this.error.set(requestErrorMessage(e)) }); }
  protected monthName(month: number): string { return new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(new Date(2026, month - 1, 1)); }
  protected formatDateTime(value: string | null): string { return value ? dateTime(value) : '—'; }
}
