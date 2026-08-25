import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiRequestError } from '../../core/errors/api-request.error';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import {
  CatalogStatus,
  Category,
  ProductListItem,
  Unit,
} from '../catalog/catalog.model';
import { CatalogService } from '../catalog/catalog.service';
import {
  InventoryMovement,
  InventoryMovementOrigin,
  InventoryMovementType,
  InventoryOperation,
  LowStockItem,
  ProductStock,
  RegisterInventoryMovementRequest,
} from './inventory.model';
import { InventoryService } from './inventory.service';

type InventoryTab = 'movements' | 'low-stock';

interface MovementForm {
  operation: InventoryOperation;
  productId: string;
  quantity: string;
  reason: string;
  notes: string;
}

@Component({
  selector: 'app-inventory',
  imports: [FormsModule],
  templateUrl: './inventory.page.html',
  styleUrl: './inventory.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly catalog = inject(CatalogService);
  private readonly inventory = inject(InventoryService);

  protected readonly canWrite = computed(() => ['ADMIN', 'WAREHOUSE'].includes(this.auth.role()));
  protected readonly activeTab = signal<InventoryTab>('movements');
  protected readonly pageSizes = [10, 20, 50];

  protected readonly movements = signal<PaginatedResponse<InventoryMovement> | null>(null);
  protected readonly lowStock = signal<PaginatedResponse<LowStockItem> | null>(null);
  protected readonly productOptions = signal<ProductListItem[]>([]);
  protected readonly categoryOptions = signal<Category[]>([]);
  protected readonly unitOptions = signal<Unit[]>([]);
  protected readonly trackedProductsTotal = signal(0);
  protected readonly selectedStock = signal<ProductStock | null>(null);

  protected readonly loadingMovements = signal(false);
  protected readonly loadingLowStock = signal(false);
  protected readonly loadingLookups = signal(false);
  protected readonly loadingStock = signal(false);
  protected readonly actionLoading = signal(false);
  protected readonly movementFormOpen = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected movementSearch = '';
  protected movementType = '';
  protected movementOrigin = '';
  protected movementDateFrom = '';
  protected movementDateTo = '';
  protected movementPageSize = 20;

  protected lowStockSearch = '';
  protected lowStockBrand = '';
  protected lowStockStatus = '';
  protected lowStockCategory = '';
  protected lowStockUnit = '';
  protected lowStockPageSize = 20;

  protected stockProductId = '';
  protected movementForm: MovementForm = emptyMovementForm();

  ngOnInit(): void {
    this.loadLookups();
    this.loadMovements();
    this.loadLowStock();
  }

  protected switchTab(tab: InventoryTab): void {
    this.activeTab.set(tab);
    this.error.set(null);
    this.notice.set(null);
  }

  protected loadLookups(): void {
    this.loadingLookups.set(true);
    forkJoin({
      products: this.catalog.listProducts({
        page: 1,
        limit: 100,
        status: 'ACTIVE',
        productType: 'PRODUCT',
        isInventoryTracked: true,
      }),
      categories: this.catalog.listCategories({ page: 1, limit: 100, status: 'ACTIVE' }),
      units: this.catalog.listUnits({ page: 1, limit: 100, status: 'ACTIVE' }),
    }).pipe(
      take(1),
      finalize(() => this.loadingLookups.set(false)),
    ).subscribe({
      next: ({ products, categories, units }) => {
        this.productOptions.set(products.data);
        this.trackedProductsTotal.set(products.total);
        this.categoryOptions.set(categories.data);
        this.unitOptions.set(units.data);
      },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  protected applyMovementFilters(event: Event): void {
    event.preventDefault();
    this.loadMovements(1);
  }

  protected clearMovementFilters(): void {
    this.movementSearch = '';
    this.movementType = '';
    this.movementOrigin = '';
    this.movementDateFrom = '';
    this.movementDateTo = '';
    this.loadMovements(1);
  }

  protected loadMovements(page = 1): void {
    this.loadingMovements.set(true);
    this.error.set(null);
    this.inventory.listMovements({
      page,
      limit: this.movementPageSize,
      ...(this.movementSearch.trim() ? { search: this.movementSearch.trim() } : {}),
      ...(this.movementType ? { movementType: this.movementType as InventoryMovementType } : {}),
      ...(this.movementOrigin ? { origin: this.movementOrigin as InventoryMovementOrigin } : {}),
      ...(this.movementDateFrom ? { dateFrom: startOfDay(this.movementDateFrom) } : {}),
      ...(this.movementDateTo ? { dateTo: endOfDay(this.movementDateTo) } : {}),
    }).pipe(
      take(1),
      finalize(() => this.loadingMovements.set(false)),
    ).subscribe({
      next: result => this.movements.set(result),
      error: error => this.error.set(errorMessage(error)),
    });
  }

  protected previousMovementPage(): void {
    const page = this.movements()?.page ?? 1;
    if (page > 1) this.loadMovements(page - 1);
  }

  protected nextMovementPage(): void {
    const result = this.movements();
    if (result && result.page < result.totalPages) this.loadMovements(result.page + 1);
  }

  protected applyLowStockFilters(event: Event): void {
    event.preventDefault();
    this.loadLowStock(1);
  }

  protected clearLowStockFilters(): void {
    this.lowStockSearch = '';
    this.lowStockBrand = '';
    this.lowStockStatus = '';
    this.lowStockCategory = '';
    this.lowStockUnit = '';
    this.loadLowStock(1);
  }

  protected loadLowStock(page = 1): void {
    this.loadingLowStock.set(true);
    this.error.set(null);
    this.inventory.listLowStock({
      page,
      limit: this.lowStockPageSize,
      ...(this.lowStockSearch.trim() ? { search: this.lowStockSearch.trim() } : {}),
      ...(this.lowStockBrand.trim() ? { brand: this.lowStockBrand.trim() } : {}),
      ...(this.lowStockStatus ? { status: this.lowStockStatus as 'ACTIVE' | 'INACTIVE' } : {}),
      ...(this.lowStockCategory ? { categoryId: this.lowStockCategory } : {}),
      ...(this.lowStockUnit ? { unitId: this.lowStockUnit } : {}),
    }).pipe(
      take(1),
      finalize(() => this.loadingLowStock.set(false)),
    ).subscribe({
      next: result => this.lowStock.set(result),
      error: error => this.error.set(errorMessage(error)),
    });
  }

  protected previousLowStockPage(): void {
    const page = this.lowStock()?.page ?? 1;
    if (page > 1) this.loadLowStock(page - 1);
  }

  protected nextLowStockPage(): void {
    const result = this.lowStock();
    if (result && result.page < result.totalPages) this.loadLowStock(result.page + 1);
  }

  protected stockProductChanged(): void {
    this.selectedStock.set(null);
    if (!this.stockProductId) return;
    this.loadProductStock(this.stockProductId);
  }

  protected openMovementForm(operation: InventoryOperation = 'ENTRY', productId = ''): void {
    if (!this.canWrite()) return;
    this.error.set(null);
    this.notice.set(null);
    this.movementForm = {
      ...emptyMovementForm(),
      operation,
      productId,
      reason: defaultReason(operation),
    };
    this.selectedStock.set(null);
    this.movementFormOpen.set(true);
    if (productId) this.loadProductStock(productId);
  }

  protected closeMovementForm(): void {
    if (this.actionLoading()) return;
    this.movementFormOpen.set(false);
    this.selectedStock.set(null);
    this.error.set(null);
  }

  protected movementOperationChanged(): void {
    this.movementForm.reason = defaultReason(this.movementForm.operation);
  }

  protected movementProductChanged(): void {
    this.selectedStock.set(null);
    if (this.movementForm.productId) {
      this.loadProductStock(this.movementForm.productId);
    }
  }

  protected submitMovement(event: Event): void {
    event.preventDefault();
    const validation = validateMovement(this.movementForm, this.selectedProductOption());
    if (validation) {
      this.error.set(validation);
      return;
    }

    const request: RegisterInventoryMovementRequest = {
      productId: this.movementForm.productId,
      quantity: this.movementForm.quantity.trim(),
      reason: this.movementForm.reason.trim(),
      ...(this.movementForm.notes.trim() ? { notes: this.movementForm.notes.trim() } : {}),
    };

    this.actionLoading.set(true);
    this.error.set(null);
    this.inventory.registerMovement(this.movementForm.operation, request).pipe(
      take(1),
      finalize(() => this.actionLoading.set(false)),
    ).subscribe({
      next: movement => {
        this.notice.set(`${operationSuccessLabel(this.movementForm.operation)}. Stock actual: ${movement.newStock}.`);
        this.movementFormOpen.set(false);
        this.selectedStock.set(null);
        this.stockProductId = movement.product.id;
        this.loadProductStock(movement.product.id);
        this.loadMovements(1);
        this.loadLowStock(1);
        this.activeTab.set('movements');
      },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  protected selectedProductOption(): ProductListItem | undefined {
    return this.productOptions().find(product => product.id === this.movementForm.productId);
  }

  protected movementLabel(type: InventoryMovementType): string {
    return MOVEMENT_LABELS[type];
  }

  protected originLabel(origin: InventoryMovementOrigin): string {
    return ORIGIN_LABELS[origin];
  }

  protected operationLabel(operation: InventoryOperation): string {
    return operationLabel(operation);
  }

  protected movementSign(type: InventoryMovementType): string {
    return type === 'ENTRY' || type === 'ADJUSTMENT_IN' ? '+' : '−';
  }

  protected movementTone(type: InventoryMovementType): 'ok' | 'danger' | 'info' {
    if (type === 'ENTRY') return 'ok';
    if (type === 'EXIT') return 'danger';
    return 'info';
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  protected rangeSummary(result: PaginatedResponse<unknown> | null): string {
    if (!result || result.total === 0) return '0 resultados';
    const from = (result.page - 1) * result.limit + 1;
    const to = Math.min(result.page * result.limit, result.total);
    return `${from}–${to} de ${result.total}`;
  }

  protected stockLevel(item: LowStockItem): 'zero' | 'low' {
    return Number(item.stockCurrent) === 0 ? 'zero' : 'low';
  }

  private loadProductStock(productId: string): void {
    this.loadingStock.set(true);
    this.inventory.getProductStock(productId).pipe(
      take(1),
      finalize(() => this.loadingStock.set(false)),
    ).subscribe({
      next: stock => this.selectedStock.set(stock),
      error: error => this.error.set(errorMessage(error)),
    });
  }
}

const MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  ENTRY: 'Entrada',
  EXIT: 'Salida',
  ADJUSTMENT_IN: 'Ajuste positivo',
  ADJUSTMENT_OUT: 'Ajuste negativo',
};

const ORIGIN_LABELS: Record<InventoryMovementOrigin, string> = {
  MANUAL: 'Manual',
  INITIAL_BALANCE: 'Saldo inicial',
  SALE: 'Venta',
  SALE_CANCELLATION: 'Anulación de venta',
  OTHER: 'Otro',
};

function emptyMovementForm(): MovementForm {
  return {
    operation: 'ENTRY',
    productId: '',
    quantity: '',
    reason: defaultReason('ENTRY'),
    notes: '',
  };
}

function defaultReason(operation: InventoryOperation): string {
  const labels: Record<InventoryOperation, string> = {
    INITIAL_BALANCE: 'Saldo inicial de apertura',
    ENTRY: 'Entrada manual de stock',
    EXIT: 'Salida manual de stock',
    ADJUSTMENT_IN: 'Ajuste positivo por conteo',
    ADJUSTMENT_OUT: 'Ajuste negativo por conteo',
  };
  return labels[operation];
}

function operationLabel(operation: InventoryOperation): string {
  const labels: Record<InventoryOperation, string> = {
    INITIAL_BALANCE: 'Saldo inicial',
    ENTRY: 'Entrada',
    EXIT: 'Salida',
    ADJUSTMENT_IN: 'Ajuste positivo',
    ADJUSTMENT_OUT: 'Ajuste negativo',
  };
  return labels[operation];
}

function operationSuccessLabel(operation: InventoryOperation): string {
  const labels: Record<InventoryOperation, string> = {
    INITIAL_BALANCE: 'Saldo inicial registrado',
    ENTRY: 'Entrada registrada',
    EXIT: 'Salida registrada',
    ADJUSTMENT_IN: 'Ajuste positivo registrado',
    ADJUSTMENT_OUT: 'Ajuste negativo registrado',
  };
  return labels[operation];
}

function validateMovement(form: MovementForm, product?: ProductListItem): string | null {
  if (!form.productId) return 'Selecciona un producto.';
  const quantity = form.quantity.trim();
  if (!/^\d{1,11}(\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0) {
    return 'La cantidad debe ser mayor que cero y tener máximo 3 decimales.';
  }
  if (product && !product.unit.allowDecimal && !Number.isInteger(Number(quantity))) {
    return `La unidad ${product.unit.abbreviation} solo admite cantidades enteras.`;
  }
  const reason = form.reason.trim();
  if (!reason) return 'El motivo es obligatorio.';
  if (reason.length > 200) return 'El motivo no puede superar 200 caracteres.';
  if (form.notes.trim().length > 500) return 'Las notas no pueden superar 500 caracteres.';
  return null;
}

function startOfDay(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString();
}

function endOfDay(value: string): string {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof ApiRequestError
    ? error.message
    : 'No se pudo completar la operación. Inténtalo nuevamente.';
}
