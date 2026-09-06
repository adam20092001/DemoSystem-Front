import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { dateTime, money, pageRange, requestErrorMessage, validAmount } from '../commercial/commercial.util';
import { CashSession, CashSessionDetail, CashSessionStatus } from './cash-session.model';
import { CashSessionsService } from './cash-sessions.service';

type CashForm = 'open' | 'close' | null;
type ReviewAction = 'approve' | 'reject';

@Component({
  selector: 'app-cash-sessions',
  imports: [FormsModule],
  templateUrl: './cash-sessions.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './cash-sessions.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashSessionsPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly service = inject(CashSessionsService);
  protected readonly canOperate = computed(() => ['ADMIN', 'SELLER'].includes(this.auth.role()));
  protected readonly canReview = computed(() => ['ADMIN', 'MANAGEMENT'].includes(this.auth.role()));
  protected readonly history = signal<PaginatedResponse<CashSession> | null>(null);
  protected readonly detail = signal<CashSessionDetail | null>(null);
  protected readonly formOpen = signal<CashForm>(null);
  protected readonly reviewAction = signal<ReviewAction | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadingCurrent = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected openingAmount = '0.00';
  protected countedCashAmount = '';
  protected closingObservation = '';
  protected reviewText = '';
  protected statusFilter = '';
  protected openedFrom = '';
  protected openedTo = '';
  protected differenceFilter = '';
  protected pageSize = 20;
  protected readonly statuses: CashSessionStatus[] = ['OPEN', 'PENDING_APPROVAL', 'CLOSED'];
  protected readonly pageSizes = [10, 20, 50];

  ngOnInit(): void {
    this.loadCurrent();
    this.loadHistory();
  }

  protected openOpeningForm(): void {
    this.openingAmount = '0.00';
    this.error.set(null);
    this.formOpen.set('open');
  }

  protected openClosingForm(): void {
    const current = this.service.current();
    if (!current || current.status !== 'OPEN') return;
    this.countedCashAmount = current.liveExpectedCashAmount ?? current.openingAmount;
    this.closingObservation = '';
    this.error.set(null);
    this.formOpen.set('close');
  }

  protected submitOpen(event: Event): void {
    event.preventDefault();
    if (!validAmount(this.openingAmount, true)) { this.error.set('Ingresa un monto de apertura válido.'); return; }
    this.saving.set(true);
    this.error.set(null);
    this.service.open(this.openingAmount.trim()).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.formOpen.set(null);
        this.notice.set('Caja abierta correctamente.');
        this.loadCurrent();
        this.loadHistory(1);
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected submitClose(event: Event): void {
    event.preventDefault();
    const current = this.service.current();
    if (!current || current.status !== 'OPEN') return;
    if (!validAmount(this.countedCashAmount, true)) { this.error.set('Ingresa el efectivo contado.'); return; }
    const expected = Number(current.liveExpectedCashAmount ?? 0);
    if (Math.round((Number(this.countedCashAmount) - expected) * 100) !== 0 && !this.closingObservation.trim()) {
      this.error.set('Describe el motivo de la diferencia encontrada.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.service.close(this.countedCashAmount.trim(), this.closingObservation.trim() || undefined)
      .pipe(take(1), finalize(() => this.saving.set(false)))
      .subscribe({
        next: session => {
          this.formOpen.set(null);
          this.notice.set(session.status === 'CLOSED' ? 'Caja cerrada correctamente.' : 'El cierre quedó pendiente de revisión.');
          this.loadCurrent();
          this.loadHistory(1);
        },
        error: error => this.error.set(requestErrorMessage(error)),
      });
  }

  protected openDetail(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getDetail(id).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: detail => this.detail.set(detail),
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected startReview(action: ReviewAction): void {
    this.reviewText = '';
    this.error.set(null);
    this.reviewAction.set(action);
  }

  protected submitReview(event: Event): void {
    event.preventDefault();
    const detail = this.detail();
    const action = this.reviewAction();
    if (!detail || !action) return;
    if (action === 'reject' && !this.reviewText.trim()) { this.error.set('Ingresa el motivo del rechazo.'); return; }
    this.saving.set(true);
    this.error.set(null);
    const request$ = action === 'approve'
      ? this.service.approve(detail.id, this.reviewText.trim() || undefined)
      : this.service.reject(detail.id, this.reviewText.trim());
    request$.pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: session => {
        this.reviewAction.set(null);
        this.notice.set(action === 'approve' ? 'El cierre fue aprobado.' : 'El cierre fue rechazado y la caja volvió a abrirse.');
        this.openDetail(session.id);
        this.loadHistory(this.history()?.page ?? 1);
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected canReviewSession(session: CashSession): boolean {
    return this.canReview() && session.status === 'PENDING_APPROVAL' && session.userId !== this.auth.userId();
  }

  protected applyFilters(event: Event): void { event.preventDefault(); this.loadHistory(1); }
  protected clearFilters(): void { this.statusFilter = ''; this.openedFrom = ''; this.openedTo = ''; this.differenceFilter = ''; this.loadHistory(1); }
  protected previousPage(): void { const page = this.history()?.page ?? 1; if (page > 1) this.loadHistory(page - 1); }
  protected nextPage(): void { const result = this.history(); if (result && result.page < result.totalPages) this.loadHistory(result.page + 1); }
  protected range(): string { return pageRange(this.history()); }
  protected formatMoney(value: string | number | null): string { return money(value ?? 0); }
  protected formatDate(value: string | null): string { return value ? dateTime(value) : '—'; }
  protected ownerLabel(session: CashSession): string { return session.userId === this.auth.userId() ? 'Mi caja' : 'Otro operador'; }
  protected hasDifference(session: CashSession): boolean { return Number(session.differenceAmount ?? 0) !== 0; }
  protected statusLabel(status: CashSessionStatus): string { return { OPEN: 'Abierta', PENDING_APPROVAL: 'Por revisar', CLOSED: 'Cerrada' }[status]; }
  protected statusClass(status: CashSessionStatus): string { return status === 'OPEN' ? 'badge--ok' : status === 'PENDING_APPROVAL' ? 'badge--warn' : 'badge--neutral'; }
  protected currentBreakdown() { return this.service.current()?.liveBreakdownByMethod ?? this.service.current()?.breakdownByMethod ?? []; }
  protected detailBreakdown() { return this.detail()?.liveBreakdownByMethod ?? this.detail()?.breakdownByMethod ?? []; }

  protected loadHistory(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.list({
      page,
      limit: this.pageSize,
      ...(this.statusFilter ? { status: this.statusFilter as CashSessionStatus } : {}),
      ...(this.openedFrom ? { openedFrom: this.openedFrom } : {}),
      ...(this.openedTo ? { openedTo: this.openedTo } : {}),
      ...(this.differenceFilter ? { hasDifference: this.differenceFilter === 'true' } : {}),
    }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: result => this.history.set(result),
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  private loadCurrent(): void {
    if (!this.canOperate()) { this.service.current.set(null); return; }
    this.loadingCurrent.set(true);
    this.service.refreshCurrent().pipe(take(1), finalize(() => this.loadingCurrent.set(false))).subscribe({
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
}
