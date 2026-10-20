import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, finalize, forkJoin, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { saveDownload } from '../../core/http/file-download';
import { ProductListItem } from '../catalog/catalog.model';
import { CatalogService } from '../catalog/catalog.service';
import { PaymentMethodDefinition } from '../payment-methods/payment-method.model';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import {
  CreateQuoteRequest,
  Customer,
  PaymentMethod,
  PaymentRequest,
  QuoteDetail,
  QuoteListItem,
  QuoteStatus,
  SaleDetail,
  UpdateQuoteRequest,
} from './commercial.model';
import { CommercialService } from './commercial.service';
import {
  money,
  quantity,
  pageRange,
  requestErrorMessage,
  requiresPaymentReference,
  shortDate,
  validAmount,
  validQuantity,
} from './commercial.util';

interface QuoteFormLine { key: number; productId: string; quantity: string; discountType: '' | 'FIXED' | 'PERCENT'; discountValue: string; }
interface QuoteForm { customerId: string; expirationDate: string; discountAmount: string; notes: string; items: QuoteFormLine[]; }
interface ConversionPaymentLine { key: number; method: PaymentMethod; amount: string; reference: string; }
type QuoteAction = 'accept' | 'reject';

@Component({
  selector: 'app-quotes',
  imports: [FormsModule],
  templateUrl: './quotes.page.html',
  styleUrls: ['./commercial-page.shared.scss', './quotes.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotesPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly commercial = inject(CommercialService);
  private readonly catalog = inject(CatalogService);
  private readonly paymentMethodsService = inject(PaymentMethodsService);

  protected readonly canWrite = computed(() => ['ADMIN', 'SELLER'].includes(this.auth.role()));
  protected readonly result = signal<PaginatedResponse<QuoteListItem> | null>(null);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly products = signal<ProductListItem[]>([]);
  protected readonly productSearch = signal('');
  protected readonly filteredProducts = computed(() => {
    const search = this.productSearch().trim().toLocaleLowerCase('es');
    const products = search
      ? this.products().filter(product => [product.sku, product.name, product.brand, product.category.name].filter(Boolean).some(value => value!.toLocaleLowerCase('es').includes(search)))
      : this.products();
    return products.slice(0, 30);
  });
  protected readonly loading = signal(false);
  protected readonly loadingLookups = signal(false);
  protected readonly actionLoading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<QuoteDetail | null>(null);
  protected readonly detail = signal<QuoteDetail | null>(null);
  protected readonly pendingAction = signal<{ action: QuoteAction; quote: QuoteListItem | QuoteDetail } | null>(null);
  protected readonly convertQuote = signal<QuoteListItem | QuoteDetail | null>(null);
  protected readonly createdSale = signal<SaleDetail | null>(null);

  protected readonly statuses: QuoteStatus[] = ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'];
  protected readonly pageSizes = [10, 20, 50];
  protected readonly paymentMethods = signal<PaymentMethodDefinition[]>([]);

  protected search = '';
  protected status = '';
  protected issueDateFrom = '';
  protected issueDateTo = '';
  protected pageSize = 20;
  protected form: QuoteForm = emptyQuoteForm();
  protected conversionPaymentEnabled = false;
  protected conversionPayments: ConversionPaymentLine[] = [];
  private lineKey = 1;
  private conversionPaymentKey = 1;

  ngOnInit(): void {
    this.loadLookups();
    this.loadPaymentMethods();
    this.loadQuotes();
  }

  protected applyFilters(event: Event): void { event.preventDefault(); this.loadQuotes(1); }
  protected clearFilters(): void { this.search = ''; this.status = ''; this.issueDateFrom = ''; this.issueDateTo = ''; this.loadQuotes(1); }
  protected previousPage(): void { const page = this.result()?.page ?? 1; if (page > 1) this.loadQuotes(page - 1); }
  protected nextPage(): void { const value = this.result(); if (value && value.page < value.totalPages) this.loadQuotes(value.page + 1); }

  protected openCreate(): void {
    this.error.set(null);
    this.editing.set(null);
    this.form = emptyQuoteForm(this.nextLineKey());
    this.productSearch.set('');
    this.formOpen.set(true);
  }

  protected openEdit(id: string): void {
    if (!this.canWrite()) return;
    this.actionLoading.set(true);
    this.error.set(null);
    this.commercial.getQuote(id).pipe(take(1), finalize(() => this.actionLoading.set(false))).subscribe({
      next: quote => {
        this.editing.set(quote);
        this.form = {
          customerId: quote.customerId,
          expirationDate: quote.expirationDate,
          discountAmount: quote.discountAmount,
          notes: quote.notes ?? '',
          items: quote.items.map(item => ({ key: this.nextLineKey(), productId: item.productId, quantity: item.quantity, discountType: item.discountType ?? '', discountValue: item.discountValue ?? '0' })),
        };
        this.detail.set(null);
        this.formOpen.set(true);
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected closeForm(): void { if (!this.actionLoading()) { this.formOpen.set(false); this.editing.set(null); this.error.set(null); } }
  protected addProduct(product: ProductListItem): void {
    const existing = this.form.items.find(item => item.productId === product.id);
    if (existing) existing.quantity = String(Number(existing.quantity || 0) + 1);
    else this.form.items = [...this.form.items, { key: this.nextLineKey(), productId: product.id, quantity: '1', discountType: '', discountValue: '0' }];
  }
  protected removeLine(key: number): void { this.form.items = this.form.items.filter(item => item.key !== key); }
  protected changeQuantity(line: QuoteFormLine, step: number): void {
    const next = Number(line.quantity || 0) + step;
    if (next <= 0) { this.removeLine(line.key); return; }
    line.quantity = String(next);
    this.form.items = [...this.form.items];
  }
  protected isInQuote(productId: string): boolean { return this.form.items.some(item => item.productId === productId); }
  protected productImage(product: ProductListItem): string | null { return product.primaryImage ? this.catalog.imageUrl(product.primaryImage.fileUrl) : null; }

  protected submitQuote(event: Event): void {
    event.preventDefault();
    const validation = validateQuoteForm(this.form);
    if (validation) { this.error.set(validation); return; }
    for (const item of this.form.items) {
      const product = this.productFor(item.productId);
      if (product && !product.unit.allowDecimal && !Number.isInteger(Number(item.quantity))) {
        this.error.set(`${product.name} solo admite cantidades enteras.`);
        return;
      }
    }
    const editing = this.editing();
    let request$: Observable<QuoteDetail>;
    const items = this.form.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity.trim(),
      ...(item.discountType ? { discountType: item.discountType, discountValue: item.discountValue.trim() || '0' } : {}),
    }));
    if (editing) {
      const request: UpdateQuoteRequest = {
        ...(this.form.expirationDate ? { expirationDate: this.form.expirationDate } : {}),
        discountAmount: this.form.discountAmount.trim() || '0',
        notes: this.form.notes.trim(),
        items,
      };
      request$ = this.commercial.updateQuote(editing.id, request);
    } else {
      const request: CreateQuoteRequest = {
        customerId: this.form.customerId,
        ...(this.form.expirationDate ? { expirationDate: this.form.expirationDate } : {}),
        discountAmount: this.form.discountAmount.trim() || '0',
        ...(this.form.notes.trim() ? { notes: this.form.notes.trim() } : {}),
        items,
      };
      request$ = this.commercial.createQuote(request);
    }
    this.actionLoading.set(true);
    this.error.set(null);
    request$.pipe(take(1), finalize(() => this.actionLoading.set(false))).subscribe({
      next: quote => {
        this.formOpen.set(false);
        this.editing.set(null);
        this.notice.set(editing ? `${quote.number} fue actualizada.` : `${quote.number} fue creada.`);
        this.loadQuotes(editing ? (this.result()?.page ?? 1) : 1);
        this.openDetail(quote.id);
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected openDetail(id: string): void {
    this.actionLoading.set(true);
    this.error.set(null);
    this.commercial.getQuote(id).pipe(take(1), finalize(() => this.actionLoading.set(false))).subscribe({
      next: quote => this.detail.set(quote),
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected askAction(action: QuoteAction, quote: QuoteListItem | QuoteDetail): void { this.pendingAction.set({ action, quote }); }
  protected runAction(): void {
    const pending = this.pendingAction();
    if (!pending) return;
    this.actionLoading.set(true);
    this.commercial.changeQuoteState(pending.quote.id, pending.action).pipe(take(1), finalize(() => this.actionLoading.set(false))).subscribe({
      next: quote => {
        this.pendingAction.set(null);
        this.detail.set(quote);
        this.notice.set(`${quote.number} fue ${pending.action === 'accept' ? 'aceptada' : 'rechazada'}.`);
        this.loadQuotes(this.result()?.page ?? 1);
      },
      error: error => { this.pendingAction.set(null); this.error.set(requestErrorMessage(error)); },
    });
  }

  protected openConversion(quote: QuoteListItem | QuoteDetail): void {
    this.convertQuote.set(quote);
    this.conversionPaymentEnabled = false;
    this.conversionPayments = [];
    this.error.set(null);
  }

  protected submitConversion(event: Event): void {
    event.preventDefault();
    const quote = this.convertQuote();
    if (!quote) return;
    let payments: PaymentRequest[] | undefined;
    if (this.conversionPaymentEnabled) {
      if (!this.conversionPayments.length || this.conversionPayments.length > 10) { this.error.set('Registra entre 1 y 10 pagos iniciales.'); return; }
      for (const line of this.conversionPayments) {
        const error = validatePayment(this.paymentMethods(), line.method, line.amount, line.reference);
        if (error) { this.error.set(error); return; }
      }
      const total = this.conversionPayments.reduce((sum, line) => sum + Number(line.amount || 0), 0);
      if (total > Number(quote.total)) { this.error.set('La suma de los pagos no puede superar el total.'); return; }
      payments = this.conversionPayments.map(line => ({ method: line.method, amount: line.amount.trim(), ...(line.reference.trim() ? { reference: line.reference.trim() } : {}) }));
    }
    this.actionLoading.set(true);
    this.commercial.createSaleFromQuote(quote.id, payments).pipe(take(1), finalize(() => this.actionLoading.set(false))).subscribe({
      next: sale => {
        this.convertQuote.set(null);
        this.detail.set(null);
        this.createdSale.set(sale);
        this.notice.set(`${quote.number} se convirtió en la venta ${sale.number}.`);
        this.loadQuotes(this.result()?.page ?? 1);
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected productFor(id: string): ProductListItem | undefined { return this.products().find(product => product.id === id); }
  protected lineGrossTotal(line: QuoteFormLine): number { return Number(this.productFor(line.productId)?.salePrice ?? 0) * Number(line.quantity || 0); }
  protected lineDiscount(line: QuoteFormLine): number {
    const gross = this.lineGrossTotal(line);
    return line.discountType === 'PERCENT' ? gross * Number(line.discountValue || 0) / 100 : line.discountType === 'FIXED' ? Number(line.discountValue || 0) : 0;
  }
  protected lineTotal(line: QuoteFormLine): number { return Math.max(0, this.lineGrossTotal(line) - this.lineDiscount(line)); }
  protected previewSubtotal(): number { return this.form.items.reduce((sum, line) => sum + this.lineTotal(line), 0); }
  protected previewTotal(): number { return Math.max(0, this.previewSubtotal() - Number(this.form.discountAmount || 0)); }
  protected formatMoney(value: string | number, currency = 'PEN'): string { return money(value, currency); }
  protected formatDate(value: string): string { return shortDate(value); }
  protected formatQuantity(value: string | number, allowDecimal: boolean): string { return quantity(value, allowDecimal); }
  protected range(): string { return pageRange(this.result()); }
  protected selectedMethodRequiresReference(line: ConversionPaymentLine): boolean { return requiresPaymentReference(this.paymentMethods(), line.method); }
  protected toggleConversionPayment(enabled: boolean): void {
    this.conversionPaymentEnabled = enabled;
    this.conversionPayments = enabled ? [this.newConversionPayment(this.convertQuote()?.total ?? '')] : [];
  }
  protected addConversionPayment(): void { if (this.conversionPayments.length < 10) this.conversionPayments = [...this.conversionPayments, this.newConversionPayment()]; }
  protected removeConversionPayment(key: number): void { this.conversionPayments = this.conversionPayments.filter(line => line.key !== key); if (!this.conversionPayments.length) this.conversionPaymentEnabled = false; }
  protected statusLabel(status: QuoteStatus): string { return { PENDING: 'Pendiente', ACCEPTED: 'Aceptada', REJECTED: 'Rechazada', EXPIRED: 'Vencida', CONVERTED: 'Convertida' }[status]; }
  protected statusClass(status: QuoteStatus): string { return status === 'ACCEPTED' ? 'badge--ok' : status === 'PENDING' ? 'badge--warn' : status === 'CONVERTED' ? 'badge--info' : status === 'REJECTED' ? 'badge--danger' : 'badge--neutral'; }
  protected canConvert(status: QuoteStatus): boolean { return this.canWrite() && ['PENDING', 'ACCEPTED'].includes(status); }
  protected visibleStatusCount(status: QuoteStatus): number { return this.result()?.data.filter(quote => quote.status === status).length ?? 0; }

  protected exportExcel(): void {
    this.exporting.set(true);
    this.error.set(null);
    this.commercial.exportQuotes({
      ...(this.search.trim() ? { search: this.search.trim() } : {}),
      ...(this.status ? { status: this.status as QuoteStatus } : {}),
      ...(this.issueDateFrom ? { issueDateFrom: this.issueDateFrom } : {}),
      ...(this.issueDateTo ? { issueDateTo: this.issueDateTo } : {}),
    }).pipe(take(1), finalize(() => this.exporting.set(false))).subscribe({
      next: blob => saveDownload(blob, `cotizaciones-${new Date().toISOString().slice(0, 10)}.xlsx`),
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected loadQuotes(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.commercial.listQuotes({
      page, limit: this.pageSize,
      ...(this.search.trim() ? { search: this.search.trim() } : {}),
      ...(this.status ? { status: this.status as QuoteStatus } : {}),
      ...(this.issueDateFrom ? { issueDateFrom: this.issueDateFrom } : {}),
      ...(this.issueDateTo ? { issueDateTo: this.issueDateTo } : {}),
    }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: result => this.result.set(result), error: error => this.error.set(requestErrorMessage(error)) });
  }

  private loadLookups(): void {
    this.loadingLookups.set(true);
    forkJoin({
      customers: this.commercial.listCustomers({ page: 1, limit: 100, status: 'ACTIVE' }),
      products: this.catalog.listProducts({ page: 1, limit: 100, status: 'ACTIVE' }),
    }).pipe(take(1), finalize(() => this.loadingLookups.set(false))).subscribe({
      next: ({ customers, products }) => { this.customers.set(customers.data.filter(customer => !customer.isGeneric)); this.products.set(products.data); },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  private loadPaymentMethods(): void {
    this.paymentMethodsService.listActive().pipe(take(1)).subscribe({
      next: methods => {
        this.paymentMethods.set(methods);
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  private defaultPaymentMethod(): string {
    return this.paymentMethods().find(method => method.code === 'CASH')?.code ?? this.paymentMethods()[0]?.code ?? '';
  }

  private newConversionPayment(amount = ''): ConversionPaymentLine {
    return { key: this.conversionPaymentKey++, method: this.defaultPaymentMethod(), amount, reference: '' };
  }

  private nextLineKey(): number { return this.lineKey++; }
}

function emptyQuoteForm(_key = 1): QuoteForm {
  return { customerId: '', expirationDate: '', discountAmount: '0', notes: '', items: [] };
}

function validateQuoteForm(form: QuoteForm): string | null {
  if (!form.customerId) return 'Selecciona un cliente.';
  if (!validAmount(form.discountAmount || '0', true)) return 'El descuento debe ser un monto válido con máximo 2 decimales.';
  if (!form.items.length || form.items.some(item => !item.productId)) return 'Agrega al menos un producto o servicio.';
  if (form.items.some(item => !validQuantity(item.quantity))) return 'Cada cantidad debe ser mayor que cero y tener máximo 3 decimales.';
  if (new Set(form.items.map(item => item.productId)).size !== form.items.length) return 'No repitas productos; ajusta la cantidad en una sola línea.';
  if (form.items.some(item => item.discountType && !validAmount(item.discountValue || '0', true))) return 'Cada descuento debe ser un valor válido con máximo 2 decimales.';
  if (form.items.some(item => item.discountType === 'PERCENT' && Number(item.discountValue) > 100)) return 'El descuento porcentual no puede superar 100%.';
  return null;
}

function validatePayment(methods: readonly PaymentMethodDefinition[], method: PaymentMethod, amount: string, reference: string): string | null {
  if (!method || !methods.some(item => item.code === method)) return 'Selecciona un método de pago disponible.';
  if (!validAmount(amount)) return 'El pago debe ser mayor que cero y tener máximo 2 decimales.';
  if (requiresPaymentReference(methods, method) && !reference.trim()) return 'Ingresa la referencia del pago.';
  return null;
}
