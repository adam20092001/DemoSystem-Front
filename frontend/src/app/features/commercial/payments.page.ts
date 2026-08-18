import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { Payment, PaymentMethod, PaymentStatus, ReceivableItem } from './commercial.model';
import { CommercialService } from './commercial.service';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  dateTime,
  money,
  pageRange,
  requestErrorMessage,
  requiresPaymentReference,
  validAmount,
} from './commercial.util';

type PaymentsTab = 'payments' | 'receivables';

@Component({
  selector: 'app-payments',
  imports: [FormsModule],
  templateUrl: './payments.page.html',
  styleUrl: './commercial-page.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly commercial = inject(CommercialService);
  protected readonly canWrite = computed(() => ['ADMIN', 'SELLER'].includes(this.auth.role()));
  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  protected readonly activeTab = signal<PaymentsTab>('payments');
  protected readonly payments = signal<PaginatedResponse<Payment> | null>(null);
  protected readonly receivables = signal<PaginatedResponse<ReceivableItem> | null>(null);
  protected readonly loadingPayments = signal(false);
  protected readonly loadingReceivables = signal(false);
  protected readonly actionLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly cancelPayment = signal<Payment | null>(null);
  protected readonly receivablePayment = signal<ReceivableItem | null>(null);

  protected readonly paymentMethods = PAYMENT_METHODS;
  protected readonly paymentStatuses: PaymentStatus[] = ['ACTIVE', 'CANCELLED'];
  protected readonly pageSizes = [10, 20, 50];
  protected paymentMethodFilter = '';
  protected paymentStatusFilter = '';
  protected paidFrom = '';
  protected paidTo = '';
  protected paymentPageSize = 20;
  protected receivableFrom = '';
  protected receivableTo = '';
  protected receivablePageSize = 20;
  protected cancellationReason = '';
  protected registerMethod: PaymentMethod = 'CASH';
  protected registerAmount = '';
  protected registerReference = '';

  ngOnInit(): void { this.loadPayments(); this.loadReceivables(); }
  protected switchTab(tab: PaymentsTab): void { this.activeTab.set(tab); this.error.set(null); }
  protected applyPaymentFilters(event: Event): void { event.preventDefault(); this.loadPayments(1); }
  protected clearPaymentFilters(): void { this.paymentMethodFilter = ''; this.paymentStatusFilter = ''; this.paidFrom = ''; this.paidTo = ''; this.loadPayments(1); }
  protected applyReceivableFilters(event: Event): void { event.preventDefault(); this.loadReceivables(1); }
  protected clearReceivableFilters(): void { this.receivableFrom = ''; this.receivableTo = ''; this.loadReceivables(1); }
  protected previousPaymentPage(): void { const page = this.payments()?.page ?? 1; if (page > 1) this.loadPayments(page - 1); }
  protected nextPaymentPage(): void { const value = this.payments(); if (value && value.page < value.totalPages) this.loadPayments(value.page + 1); }
  protected previousReceivablePage(): void { const page = this.receivables()?.page ?? 1; if (page > 1) this.loadReceivables(page - 1); }
  protected nextReceivablePage(): void { const value = this.receivables(); if (value && value.page < value.totalPages) this.loadReceivables(value.page + 1); }

  protected askCancel(payment: Payment): void { this.cancelPayment.set(payment); this.cancellationReason = ''; this.error.set(null); }
  protected submitCancellation(event: Event): void {
    event.preventDefault();
    const payment = this.cancelPayment();
    if (!payment) return;
    if (!this.cancellationReason.trim() || this.cancellationReason.trim().length > 200) { this.error.set('Ingresa un motivo de anulación de hasta 200 caracteres.'); return; }
    this.actionLoading.set(true);
    this.commercial.cancelPayment(payment.saleId, payment.id, this.cancellationReason.trim()).pipe(take(1), finalize(() => this.actionLoading.set(false))).subscribe({
      next: result => { this.cancelPayment.set(null); this.notice.set(`Pago anulado. Saldo de ${result.sale.number}: ${money(result.sale.balanceDue)}.`); this.loadPayments(this.payments()?.page ?? 1); this.loadReceivables(1); },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected openRegisterPayment(item: ReceivableItem): void {
    this.receivablePayment.set(item);
    this.registerMethod = 'CASH';
    this.registerAmount = item.balanceDue;
    this.registerReference = '';
    this.error.set(null);
  }

  protected submitPayment(event: Event): void {
    event.preventDefault();
    const item = this.receivablePayment();
    if (!item) return;
    if (!validAmount(this.registerAmount)) { this.error.set('El pago debe ser mayor que cero y tener máximo 2 decimales.'); return; }
    if (Number(this.registerAmount) > Number(item.balanceDue)) { this.error.set('El pago no puede superar el saldo pendiente.'); return; }
    if (requiresPaymentReference(this.registerMethod) && !this.registerReference.trim()) { this.error.set('Ingresa la referencia del pago.'); return; }
    this.actionLoading.set(true);
    this.commercial.registerPayment(item.saleId, { method: this.registerMethod, amount: this.registerAmount.trim(), ...(this.registerReference.trim() ? { reference: this.registerReference.trim() } : {}) }).pipe(take(1), finalize(() => this.actionLoading.set(false))).subscribe({
      next: result => { this.receivablePayment.set(null); this.notice.set(`Pago registrado en ${result.sale.number}. Saldo: ${money(result.sale.balanceDue)}.`); this.loadPayments(1); this.loadReceivables(this.receivables()?.page ?? 1); },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected methodLabel(value: PaymentMethod): string { return PAYMENT_METHOD_LABELS[value]; }
  protected statusLabel(value: PaymentStatus): string { return value === 'ACTIVE' ? 'Activo' : 'Anulado'; }
  protected formatMoney(value: string | number): string { return money(value); }
  protected formatDate(value: string): string { return dateTime(value); }
  protected shortId(value: string): string { return value.slice(0, 8).toUpperCase(); }
  protected paymentRange(): string { return pageRange(this.payments()); }
  protected receivableRange(): string { return pageRange(this.receivables()); }
  protected activeVisiblePayments(): number { return this.payments()?.data.filter(payment => payment.status === 'ACTIVE').length ?? 0; }
  protected visibleReceivableBalance(): number { return this.receivables()?.data.reduce((sum, item) => sum + Number(item.balanceDue), 0) ?? 0; }

  protected loadPayments(page = 1): void {
    this.loadingPayments.set(true); this.error.set(null);
    this.commercial.listPayments({ page, limit: this.paymentPageSize, ...(this.paymentMethodFilter ? { method: this.paymentMethodFilter as PaymentMethod } : {}), ...(this.paymentStatusFilter ? { status: this.paymentStatusFilter as PaymentStatus } : {}), ...(this.paidFrom ? { paidFrom: this.paidFrom } : {}), ...(this.paidTo ? { paidTo: this.paidTo } : {}) }).pipe(take(1), finalize(() => this.loadingPayments.set(false))).subscribe({ next: result => this.payments.set(result), error: error => this.error.set(requestErrorMessage(error)) });
  }

  protected loadReceivables(page = 1): void {
    this.loadingReceivables.set(true); this.error.set(null);
    this.commercial.listReceivables({ page, limit: this.receivablePageSize, ...(this.receivableFrom ? { confirmedFrom: this.receivableFrom } : {}), ...(this.receivableTo ? { confirmedTo: this.receivableTo } : {}) }).pipe(take(1), finalize(() => this.loadingReceivables.set(false))).subscribe({ next: result => this.receivables.set(result), error: error => this.error.set(requestErrorMessage(error)) });
  }
}
