import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, Observable, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { saveDownload } from '../../core/http/file-download';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { shortDate, money, requestErrorMessage } from '../commercial/commercial.util';
import { PaymentMethodDefinition } from '../payment-methods/payment-method.model';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { AccountPayable, AgingBucket, AgingReport, PayablesSummary, ReconciliationReport, Supplier, SupplierPayment } from './procurement.model';
import { ProcurementService } from './procurement.service';

type PayablesTab = 'accounts' | 'summary' | 'aging' | 'payments' | 'reconciliation';

@Component({
  selector: 'app-accounts-payable', imports: [FormsModule], templateUrl: './accounts-payable.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './procurement.scss'], changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsPayablePage implements OnInit {
  private readonly api = inject(ProcurementService);
  private readonly paymentMethodsApi = inject(PaymentMethodsService);
  protected readonly auth = inject(AuthService);
  protected readonly canWrite = computed(() => this.auth.role() === 'ADMIN');
  protected readonly tab = signal<PayablesTab>('accounts');
  protected readonly accounts = signal<PaginatedResponse<AccountPayable> | null>(null);
  protected readonly payments = signal<PaginatedResponse<SupplierPayment> | null>(null);
  protected readonly summary = signal<PayablesSummary | null>(null);
  protected readonly aging = signal<AgingReport | null>(null);
  protected readonly reconciliation = signal<ReconciliationReport | null>(null);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly methods = signal<PaymentMethodDefinition[]>([]);
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly paymentOpen = signal(false);
  protected supplierId = '';
  protected status = '';
  protected agingBucket = '';
  protected issueDateFrom = '';
  protected issueDateTo = '';
  protected paymentDate = today();
  protected paymentMethod = '';
  protected paymentReference = '';
  protected paymentAllocations: Array<{ purchaseInvoiceId: string; label: string; pending: string; amount: string }> = [];

  ngOnInit(): void {
    this.api.listSuppliers({ page: 1, limit: 100, status: 'ACTIVE' }).pipe(take(1)).subscribe({
      next: suppliers => this.suppliers.set(suppliers.data),
      error: error => this.error.set(requestErrorMessage(error)),
    });
    if (this.canWrite()) {
      this.paymentMethodsApi.listActive().pipe(take(1)).subscribe({
        next: methods => { this.methods.set(methods); this.paymentMethod = methods[0]?.code ?? ''; },
        error: error => this.error.set(requestErrorMessage(error)),
      });
    }
    this.reload();
  }
  protected switchTab(tab: PayablesTab): void { this.tab.set(tab); this.reload(); }
  protected filters(): object { return { supplierId: this.supplierId, status: this.status, issueDateFrom: this.issueDateFrom, issueDateTo: this.issueDateTo }; }
  protected reload(page = 1): void {
    this.loading.set(true); this.error.set(null);
    const filters = this.filters();
    const request: Observable<unknown> = this.tab() === 'accounts' ? this.api.listPayables({ ...filters, agingBucket: this.agingBucket, page, limit: 20 })
      : this.tab() === 'summary' ? this.api.getPayablesSummary(filters)
      : this.tab() === 'aging' ? this.api.getAging(filters)
      : this.tab() === 'reconciliation' ? this.api.getReconciliation(filters)
      : this.api.listSupplierPayments({ supplierId: this.supplierId, page, limit: 20 });
    request.pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: value => {
        if (this.tab() === 'accounts') this.accounts.set(value as PaginatedResponse<AccountPayable>);
        else if (this.tab() === 'summary') this.summary.set(value as PayablesSummary);
        else if (this.tab() === 'aging') this.aging.set(value as AgingReport);
        else if (this.tab() === 'reconciliation') this.reconciliation.set(value as ReconciliationReport);
        else this.payments.set(value as PaginatedResponse<SupplierPayment>);
      }, error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected apply(event: Event): void { event.preventDefault(); this.reload(1); }
  protected clear(): void { this.supplierId = ''; this.status = ''; this.agingBucket = ''; this.issueDateFrom = ''; this.issueDateTo = ''; this.reload(1); }
  protected openPayment(account: AccountPayable): void {
    const rows = this.accounts()?.data.filter(item => item.supplierId === account.supplierId && item.status !== 'PAID') ?? [account];
    this.supplierId = account.supplierId;
    this.paymentDate = today(); this.paymentReference = '';
    this.paymentAllocations = rows.map(item => ({ purchaseInvoiceId: item.purchaseInvoiceId, label: `${item.documentSeries ? item.documentSeries + '-' : ''}${item.documentNumber}`, pending: item.balanceDue, amount: item.purchaseInvoiceId === account.purchaseInvoiceId ? item.balanceDue : '0.00' }));
    this.paymentOpen.set(true);
  }
  protected paymentTotal(): number { return this.paymentAllocations.reduce((sum, item) => sum + (Number(item.amount) || 0), 0); }
  protected savePayment(): void {
    const allocations = this.paymentAllocations.filter(item => Number(item.amount) > 0).map(item => ({ purchaseInvoiceId: item.purchaseInvoiceId, amount: Number(item.amount).toFixed(2) }));
    if (!this.supplierId || !this.paymentMethod || !allocations.length) { this.error.set('Selecciona método e ingresa al menos una aplicación de pago.'); return; }
    this.loading.set(true);
    this.api.createSupplierPayment({ supplierId: this.supplierId, paymentDate: this.paymentDate, amount: this.paymentTotal().toFixed(2), method: this.paymentMethod, reference: this.paymentReference.trim() || undefined, idempotencyKey: crypto.randomUUID(), allocations }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: () => { this.paymentOpen.set(false); this.notice.set('Pago al proveedor registrado.'); this.reload(); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected cancelPayment(payment: SupplierPayment): void { const reason = prompt('Motivo para anular el pago:')?.trim(); if (!reason) return; this.api.cancelSupplierPayment(payment.id, reason).pipe(take(1)).subscribe({ next: () => { this.notice.set('Pago anulado.'); this.reload(); }, error: error => this.error.set(requestErrorMessage(error)) }); }
  protected exportCurrent(): void {
    const kind = this.tab() === 'summary' ? 'summary' : this.tab() === 'aging' ? 'aging' : this.tab() === 'reconciliation' ? 'reconciliation' : 'list';
    this.exporting.set(true);
    this.api.exportPayables(kind, { ...this.filters(), agingBucket: this.agingBucket }).pipe(take(1), finalize(() => this.exporting.set(false))).subscribe({ next: blob => saveDownload(blob, `cuentas-por-pagar-${kind}.xlsx`), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected supplierName(id: string): string { return this.suppliers().find(item => item.id === id)?.legalName ?? 'Proveedor'; }
  protected statusLabel(value: string): string { return ({ UNPAID: 'Pendiente', PARTIALLY_PAID: 'Pago parcial', PAID: 'Pagada', ACTIVE: 'Activo', CANCELLED: 'Anulado' } as Record<string, string>)[value] ?? value; }
  protected bucketLabel(value: AgingBucket): string { return ({ NOT_OVERDUE: 'Por vencer', OVERDUE_1_30: '1–30 días', OVERDUE_31_60: '31–60 días', OVERDUE_61_90: '61–90 días', OVERDUE_90_PLUS: 'Más de 90 días', NO_DUE_DATE: 'Sin vencimiento' })[value]; }
  protected formatMoney(value: string | number): string { return money(value); }
  protected formatDate(value: string): string { return shortDate(value); }
}
function today(): string { return new Date().toISOString().slice(0, 10); }
