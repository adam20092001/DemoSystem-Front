import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, Observable, take } from 'rxjs';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { AuthService } from '../../core/auth/auth.service';
import { ProductListItem } from '../catalog/catalog.model';
import { CatalogService } from '../catalog/catalog.service';
import { requestErrorMessage, shortDate } from '../commercial/commercial.util';
import { PendingValuationItem, ValuedInventoryItem } from './inventory-valuation.model';
import { InventoryValuationService } from './inventory-valuation.service';

type ValuationTab = 'valued' | 'pending';

@Component({
  selector: 'app-inventory-valuation',
  imports: [FormsModule],
  templateUrl: './inventory-valuation.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './inventory-valuation.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryValuationPage implements OnInit {
  private readonly api = inject(InventoryValuationService);
  private readonly catalogApi = inject(CatalogService);
  protected readonly auth = inject(AuthService);
  protected readonly tab = signal<ValuationTab>('valued');
  protected readonly valued = signal<PaginatedResponse<ValuedInventoryItem> | null>(null);
  protected readonly pending = signal<PaginatedResponse<PendingValuationItem> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly products = signal<ProductListItem[]>([]);
  protected productId = '';
  protected pageSize = 20;

  ngOnInit(): void {
    if (this.auth.role() !== 'ACCOUNTANT') {
      this.catalogApi.listProducts({ page: 1, limit: 100, status: 'ACTIVE' }).pipe(take(1)).subscribe({
        next: result => this.products.set(result.data),
        error: error => this.error.set(requestErrorMessage(error)),
      });
    }
    this.load();
  }

  protected selectTab(tab: ValuationTab): void { this.tab.set(tab); this.load(); }
  protected apply(event: Event): void { event.preventDefault(); this.load(1); }
  protected clear(): void { this.productId = ''; this.load(1); }
  protected previous(): void { const page = this.current()?.page ?? 1; if (page > 1) this.load(page - 1); }
  protected next(): void { const result = this.current(); if (result && result.page < result.totalPages) this.load(result.page + 1); }
  protected methodLabel(method: string): string { return method === 'MOVING_WEIGHTED_AVERAGE' ? 'Promedio ponderado' : 'FIFO'; }
  protected decimal(value: string, digits = 3): string { return new Intl.NumberFormat('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value)); }
  protected currency(value: string, digits = 2): string { return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value)); }
  protected date(value: string): string { return shortDate(value); }

  protected current(): PaginatedResponse<unknown> | null { return this.tab() === 'valued' ? this.valued() : this.pending(); }
  protected load(page = 1): void {
    this.loading.set(true); this.error.set(null);
    const query = { page, limit: this.pageSize, ...(this.productId.trim() ? { productId: this.productId.trim() } : {}) };
    const request = (this.tab() === 'valued' ? this.api.list(query) : this.api.pending(query)) as Observable<PaginatedResponse<unknown>>;
    request.pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: result => this.tab() === 'valued' ? this.valued.set(result as PaginatedResponse<ValuedInventoryItem>) : this.pending.set(result as PaginatedResponse<PendingValuationItem>),
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
}
