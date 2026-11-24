import { DateInputComponent } from '../../shared/date-input.component';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { requestErrorMessage, shortDate } from '../commercial/commercial.util';
import { ProcurementService } from './procurement.service';
import { PurchaseReceiptsSummary, ReceivableInvoice, ReceivableInvoiceDetail } from './procurement.model';
import { LocationOption, LocationsService } from '../inventory/locations.service';

@Component({
  selector: 'app-purchase-receiving',
  imports: [DateInputComponent, FormsModule],
  templateUrl: './purchase-receiving.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './procurement.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseReceivingPage implements OnInit {
  private readonly api = inject(ProcurementService);
  private readonly locationsApi = inject(LocationsService);
  protected readonly auth = inject(AuthService);
  protected readonly canReceive = computed(() => ['ADMIN', 'WAREHOUSE', 'PURCHASING'].includes(this.auth.role()));
  protected readonly result = signal<PaginatedResponse<ReceivableInvoice> | null>(null);
  protected readonly selected = signal<ReceivableInvoiceDetail | null>(null);
  protected readonly receiptSummary = signal<PurchaseReceiptsSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = visibleErrorSignal();
  protected readonly notice = signal<string | null>(null);
  protected receiptDate = new Date().toISOString().slice(0, 10);
  protected receiptNotes = '';
  protected quantities: Record<string, string> = {};
  protected locationIds: Record<string, string> = {};
  protected readonly locations = signal<LocationOption[]>([]);

  ngOnInit(): void { this.load(); if (this.canReceive()) this.locationsApi.activeLocations().pipe(take(1)).subscribe({ next: value => this.locations.set(value), error: error => this.error.set(requestErrorMessage(error)) }); }

  protected load(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listReceivableInvoices({ page, limit: 20 }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: value => this.result.set(value),
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected openDetail(id: string): void {
    this.error.set(null);
    forkJoin({ invoice: this.api.getReceivableInvoice(id), receipts: this.api.getReceipts(id) }).pipe(take(1)).subscribe({
      next: ({ invoice, receipts }) => {
        this.selected.set(invoice);
        this.receiptSummary.set(receipts);
        this.receiptDate = new Date().toISOString().slice(0, 10);
        this.receiptNotes = '';
        this.quantities = {};
        this.locationIds = {};
        for (const line of invoice.lines) {
          if (Number(line.pendingQuantity) > 0) this.quantities[line.purchaseInvoiceLineId] = line.pendingQuantity;
        }
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected save(): void {
    const invoice = this.selected();
    if (!invoice || !this.canReceive()) return;
    const lines = invoice.lines.filter(line => {
      const amount = Number(this.quantities[line.purchaseInvoiceLineId] ?? 0);
      return amount > 0 && amount <= Number(line.pendingQuantity);
    }).map(line => ({ purchaseInvoiceLineId: line.purchaseInvoiceLineId, quantity: String(this.quantities[line.purchaseInvoiceLineId]), ...(this.locationIds[line.purchaseInvoiceLineId] ? { locationId: this.locationIds[line.purchaseInvoiceLineId] } : {}) }));
    if (!lines.length) { this.error.set('Ingresa una cantidad válida, sin superar lo pendiente.'); return; }
    const invalid = invoice.lines.some(line => {
      const amount = Number(this.quantities[line.purchaseInvoiceLineId] ?? 0);
      return !Number.isFinite(amount) || amount < 0 || amount > Number(line.pendingQuantity);
    });
    if (invalid) { this.error.set('Hay cantidades inválidas o mayores al pendiente.'); return; }
    this.saving.set(true);
    this.error.set(null);
    this.api.createReceipt(invoice.id, {
      receivedDate: this.receiptDate,
      notes: this.receiptNotes.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
      lines,
    }).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notice.set('Recepción registrada e inventario actualizado.');
        this.selected.set(null);
        this.receiptSummary.set(null);
        this.load(this.result()?.page ?? 1);
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected formatDate(value: string): string { return shortDate(value); }
  protected previous(): void { const page = this.result()?.page ?? 1; if (page > 1) this.load(page - 1); }
  protected next(): void { const result = this.result(); if (result && result.page < result.totalPages) this.load(result.page + 1); }
}
