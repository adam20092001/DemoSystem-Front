import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import {
  PaymentMethod,
  SaleDeliveryStatus,
  SaleDetail,
  SaleListItem,
  SalePaymentStatus,
  SaleStatus,
} from './commercial.model';
import { CommercialService } from './commercial.service';
import { ElectronicDocument, FiscalDocumentType, FiscalSeries } from '../electronic-documents/electronic-document.model';
import { ElectronicDocumentsService } from '../electronic-documents/electronic-documents.service';
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

type SaleAction = 'cancel' | 'mark-delivered' | 'mark-observed';

@Component({
  selector: 'app-sales',
  imports: [FormsModule],
  templateUrl: './sales.page.html',
  styleUrl: './commercial-page.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly commercial = inject(CommercialService);
  protected readonly electronicDocuments = inject(ElectronicDocumentsService);
  protected readonly canWrite = computed(() => ['ADMIN', 'SELLER'].includes(this.auth.role()));
  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  protected readonly result = signal<PaginatedResponse<SaleListItem> | null>(null);
  protected readonly detail = signal<SaleDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly actionLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly pendingAction = signal<{ action: SaleAction; sale: SaleListItem | SaleDetail } | null>(null);
  protected readonly paymentSale = signal<SaleListItem | SaleDetail | null>(null);
  protected readonly fiscalSale = signal<SaleListItem | SaleDetail | null>(null);
  protected readonly fiscalSeries = signal<FiscalSeries[]>([]);
  protected readonly issuedDocument = signal<ElectronicDocument | null>(null);

  protected readonly statuses: SaleStatus[] = ['ACTIVE', 'CANCELLED'];
  protected readonly paymentStatuses: SalePaymentStatus[] = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];
  protected readonly deliveryStatuses: SaleDeliveryStatus[] = ['NOT_APPLICABLE', 'PENDING', 'DELIVERED', 'OBSERVED'];
  protected readonly paymentMethods = PAYMENT_METHODS;
  protected readonly pageSizes = [10, 20, 50];

  protected search = '';
  protected status = '';
  protected paymentStatus = '';
  protected deliveryStatus = '';
  protected confirmedFrom = '';
  protected confirmedTo = '';
  protected pageSize = 20;
  protected actionReason = '';
  protected paymentMethod: PaymentMethod = 'CASH';
  protected paymentAmount = '';
  protected paymentReference = '';
  protected fiscalDocumentType: FiscalDocumentType = 'FACTURA';
  protected selectedFiscalSeries = '';

  ngOnInit(): void { this.loadSales(); }

  protected applyFilters(event: Event): void { event.preventDefault(); this.loadSales(1); }
  protected clearFilters(): void { this.search = ''; this.status = ''; this.paymentStatus = ''; this.deliveryStatus = ''; this.confirmedFrom = ''; this.confirmedTo = ''; this.loadSales(1); }
  protected previousPage(): void { const page = this.result()?.page ?? 1; if (page > 1) this.loadSales(page - 1); }
  protected nextPage(): void { const value = this.result(); if (value && value.page < value.totalPages) this.loadSales(value.page + 1); }

  protected openDetail(id: string): void {
    this.actionLoading.set(true);
    this.error.set(null);
    this.commercial.getSale(id).pipe(take(1), finalize(() => this.actionLoading.set(false))).subscribe({
      next: sale => this.detail.set(sale),
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected askAction(action: SaleAction, sale: SaleListItem | SaleDetail): void {
    this.actionReason = '';
    this.pendingAction.set({ action, sale });
    this.error.set(null);
  }

  protected runAction(event?: Event): void {
    event?.preventDefault();
    const pending = this.pendingAction();
    if (!pending) return;
    if (pending.action === 'cancel' && (!this.actionReason.trim() || this.actionReason.trim().length > 200)) {
      this.error.set('Ingresa un motivo de anulación de hasta 200 caracteres.');
      return;
    }
    this.actionLoading.set(true);
    const request$ = pending.action === 'cancel'
      ? this.commercial.cancelSale(pending.sale.id, this.actionReason.trim())
      : this.commercial.changeDeliveryState(pending.sale.id, pending.action);
    request$.pipe(take(1), finalize(() => this.actionLoading.set(false))).subscribe({
      next: sale => {
        this.pendingAction.set(null);
        this.detail.set(sale);
        this.notice.set(pending.action === 'cancel' ? `${sale.number} fue anulada.` : `Se actualizó la entrega de ${sale.number}.`);
        this.loadSales(this.result()?.page ?? 1);
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected openPayment(sale: SaleListItem | SaleDetail): void {
    this.paymentSale.set(sale);
    this.paymentMethod = 'CASH';
    this.paymentAmount = sale.balanceDue;
    this.paymentReference = '';
    this.error.set(null);
  }

  protected submitPayment(event: Event): void {
    event.preventDefault();
    const sale = this.paymentSale();
    if (!sale) return;
    if (!validAmount(this.paymentAmount)) { this.error.set('El pago debe ser mayor que cero y tener máximo 2 decimales.'); return; }
    if (Number(this.paymentAmount) > Number(sale.balanceDue)) { this.error.set('El pago no puede superar el saldo pendiente.'); return; }
    if (requiresPaymentReference(this.paymentMethod) && !this.paymentReference.trim()) { this.error.set('Ingresa la referencia del pago.'); return; }
    this.actionLoading.set(true);
    this.commercial.registerPayment(sale.id, {
      method: this.paymentMethod,
      amount: this.paymentAmount.trim(),
      ...(this.paymentReference.trim() ? { reference: this.paymentReference.trim() } : {}),
    }).pipe(take(1), finalize(() => this.actionLoading.set(false))).subscribe({
      next: result => {
        this.paymentSale.set(null);
        this.notice.set(`Pago registrado en ${result.sale.number}. Saldo: ${money(result.sale.balanceDue, sale.currencyCode)}.`);
        this.loadSales(this.result()?.page ?? 1);
        if (this.detail()?.id === sale.id) this.openDetail(sale.id);
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected openFiscalIssue(sale: SaleListItem | SaleDetail): void {
    this.fiscalSale.set(sale);
    this.fiscalDocumentType = sale.customerDocumentNumber?.length === 11 ? 'FACTURA' : 'BOLETA';
    this.selectedFiscalSeries = '';
    this.error.set(null);
    this.loadFiscalSeries();
  }

  protected changeFiscalType(type: FiscalDocumentType): void {
    this.fiscalDocumentType = type;
    this.selectedFiscalSeries = '';
    this.loadFiscalSeries();
  }

  protected submitFiscalIssue(event: Event): void {
    event.preventDefault();
    const sale = this.fiscalSale();
    if (!sale || !this.selectedFiscalSeries) { this.error.set('Selecciona una serie para emitir el comprobante.'); return; }
    this.actionLoading.set(true);
    this.error.set(null);
    this.electronicDocuments.issue(sale.id, this.fiscalDocumentType, this.selectedFiscalSeries)
      .pipe(take(1), finalize(() => this.actionLoading.set(false)))
      .subscribe({
        next: document => { this.fiscalSale.set(null); this.issuedDocument.set(document); this.notice.set(`${document.fullNumber} fue emitido correctamente.`); },
        error: error => this.error.set(requestErrorMessage(error)),
      });
  }

  protected formatMoney(value: string | number, currency = 'PEN'): string { return money(value, currency); }
  protected formatDate(value: string): string { return dateTime(value); }
  protected range(): string { return pageRange(this.result()); }
  protected methodLabel(value: PaymentMethod): string { return PAYMENT_METHOD_LABELS[value]; }
  protected saleStatusLabel(value: SaleStatus): string { return value === 'ACTIVE' ? 'Activa' : 'Anulada'; }
  protected paymentStatusLabel(value: SalePaymentStatus): string { return { UNPAID: 'Pendiente', PARTIALLY_PAID: 'Pago parcial', PAID: 'Pagada' }[value]; }
  protected deliveryStatusLabel(value: SaleDeliveryStatus): string { return { NOT_APPLICABLE: 'No aplica', PENDING: 'Pendiente', DELIVERED: 'Entregada', OBSERVED: 'Observada' }[value]; }
  protected saleStatusClass(value: SaleStatus): string { return value === 'ACTIVE' ? 'badge--ok' : 'badge--danger'; }
  protected paymentStatusClass(value: SalePaymentStatus): string { return value === 'PAID' ? 'badge--ok' : value === 'PARTIALLY_PAID' ? 'badge--info' : 'badge--warn'; }
  protected deliveryStatusClass(value: SaleDeliveryStatus): string { return value === 'DELIVERED' ? 'badge--ok' : value === 'OBSERVED' ? 'badge--danger' : value === 'PENDING' ? 'badge--warn' : 'badge--neutral'; }
  protected visibleSaleStatusCount(status: SaleStatus): number { return this.result()?.data.filter(sale => sale.status === status).length ?? 0; }
  protected visibleBalanceCount(): number { return this.result()?.data.filter(sale => this.hasBalance(sale)).length ?? 0; }
  protected visibleDeliveryCount(status: SaleDeliveryStatus): number { return this.result()?.data.filter(sale => sale.deliveryStatus === status).length ?? 0; }
  protected hasBalance(sale: SaleListItem | SaleDetail): boolean { return Number(sale.balanceDue) > 0; }

  private loadFiscalSeries(): void {
    this.actionLoading.set(true);
    this.electronicDocuments.listSeries(this.fiscalDocumentType).pipe(take(1), finalize(() => this.actionLoading.set(false))).subscribe({
      next: series => { this.fiscalSeries.set(series); this.selectedFiscalSeries = series[0]?.series ?? ''; },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected loadSales(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.commercial.listSales({
      page, limit: this.pageSize,
      ...(this.search.trim() ? { search: this.search.trim() } : {}),
      ...(this.status ? { status: this.status as SaleStatus } : {}),
      ...(this.paymentStatus ? { paymentStatus: this.paymentStatus as SalePaymentStatus } : {}),
      ...(this.deliveryStatus ? { deliveryStatus: this.deliveryStatus as SaleDeliveryStatus } : {}),
      ...(this.confirmedFrom ? { confirmedFrom: this.confirmedFrom } : {}),
      ...(this.confirmedTo ? { confirmedTo: this.confirmedTo } : {}),
    }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: result => this.result.set(result),
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
}
