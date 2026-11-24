import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiClient } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { ProductListItem } from '../catalog/catalog.model';
import { CatalogService } from '../catalog/catalog.service';
import { dateTime, requestErrorMessage } from '../commercial/commercial.util';
import { LocationOption, LocationsService, StockByLocation } from './locations.service';

interface StockTransfer {
  id: string;
  product: { id: string; sku: string; name: string };
  sourceLocation: { id: string; code: string; warehouse: { code: string } };
  destinationLocation: { id: string; code: string; warehouse: { code: string } };
  quantity: string;
  reason: string;
  notes: string | null;
  createdAt: string;
}

@Component({ selector: 'app-transfers', imports: [FormsModule], templateUrl: './transfers.page.html', styleUrls: ['../commercial/commercial-page.shared.scss'], changeDetection: ChangeDetectionStrategy.OnPush })
export class TransfersPage implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly catalog = inject(CatalogService);
  private readonly locationsApi = inject(LocationsService);
  private readonly auth = inject(AuthService);
  protected readonly canWrite = computed(() => ['ADMIN', 'WAREHOUSE'].includes(this.auth.role()));
  protected readonly products = signal<ProductListItem[]>([]);
  protected readonly locations = signal<LocationOption[]>([]);
  protected readonly stock = signal<StockByLocation | null>(null);
  protected readonly result = signal<PaginatedResponse<StockTransfer> | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = visibleErrorSignal();
  protected readonly notice = signal<string | null>(null);
  protected form = { productId: '', sourceLocationId: '', destinationLocationId: '', quantity: '', reason: '', notes: '' };
  private idempotencyKey = crypto.randomUUID();

  ngOnInit(): void {
    this.catalog.listProducts({ page: 1, limit: 100, status: 'ACTIVE', productType: 'PRODUCT', isInventoryTracked: true }).pipe(take(1)).subscribe({ next: value => this.products.set(value.data), error: error => this.error.set(requestErrorMessage(error)) });
    this.locationsApi.activeLocations().pipe(take(1)).subscribe({ next: value => this.locations.set(value), error: error => this.error.set(requestErrorMessage(error)) });
    this.load();
  }
  protected load(page = 1): void {
    this.api.get<PaginatedResponse<StockTransfer>>('inventory/transfers', { page, limit: 20 }).pipe(take(1)).subscribe({ next: value => this.result.set(value), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected productChanged(): void {
    this.stock.set(null);
    if (!this.form.productId) return;
    this.locationsApi.stockByLocation(this.form.productId).pipe(take(1)).subscribe({ next: value => this.stock.set(value), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected available(): number { return Number(this.stock()?.locations.find(row => row.location.id === this.form.sourceLocationId)?.quantity ?? 0); }
  protected allowDecimal(): boolean { return this.products().find(product => product.id === this.form.productId)?.unit.allowDecimal ?? true; }
  protected submit(): void {
    if (!this.canWrite() || !this.form.productId || !this.form.sourceLocationId || !this.form.destinationLocationId || !this.form.reason.trim() || Number(this.form.quantity) <= 0) { this.error.set('Completa producto, origen, destino, cantidad y motivo.'); return; }
    if (this.form.sourceLocationId === this.form.destinationLocationId) { this.error.set('El origen y destino deben ser distintos.'); return; }
    if (!this.allowDecimal() && !Number.isInteger(Number(this.form.quantity))) { this.error.set('Este producto solo admite cantidades enteras.'); return; }
    if (Number(this.form.quantity) > this.available()) { this.error.set('El origen no tiene saldo suficiente.'); return; }
    const body = { ...this.form, quantity: String(this.form.quantity), reason: this.form.reason.trim(), notes: this.form.notes.trim() || undefined, idempotencyKey: this.idempotencyKey };
    this.saving.set(true); this.error.set(null);
    this.api.post<StockTransfer, typeof body>('inventory/transfers', body).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.notice.set('Transferencia registrada.'); this.idempotencyKey = crypto.randomUUID(); this.form.quantity = ''; this.form.reason = ''; this.form.notes = ''; this.productChanged(); this.load(); },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected date(value: string): string { return dateTime(value); }
  protected previous(): void { const page = this.result()?.page ?? 1; if (page > 1) this.load(page - 1); }
  protected next(): void { const value = this.result(); if (value && value.page < value.totalPages) this.load(value.page + 1); }
}
