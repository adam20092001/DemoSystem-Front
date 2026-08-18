import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, finalize, forkJoin, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { ProductListItem } from '../catalog/catalog.model';
import { CatalogService } from '../catalog/catalog.service';
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
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  money,
  pageRange,
  requestErrorMessage,
  requiresPaymentReference,
  shortDate,
  validAmount,
  validQuantity,
} from './commercial.util';

interface QuoteFormLine { key: number; productId: string; quantity: string; }
interface QuoteForm { customerId: string; expirationDate: string; discountAmount: string; notes: string; items: QuoteFormLine[]; }
type QuoteAction = 'accept' | 'reject';

@Component({
  selector: 'app-quotes',
  imports: [FormsModule],
  templateUrl: './quotes.page.html',
  styleUrl: './commercial-page.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotesPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly commercial = inject(CommercialService);
  private readonly catalog = inject(CatalogService);

  protected readonly canWrite = computed(() => ['ADMIN', 'SELLER'].includes(this.auth.role()));
  protected readonly result = signal<PaginatedResponse<QuoteListItem> | null>(null);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly products = signal<ProductListItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadingLookups = signal(false);
  protected readonly actionLoading = signal(false);
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
  protected readonly paymentMethods = PAYMENT_METHODS;

  protected search = '';
  protected status = '';
  protected issueDateFrom = '';
  protected issueDateTo = '';
  protected pageSize = 20;
  protected form: QuoteForm = emptyQuoteForm();
  protected conversionPaymentEnabled = false;
  protected conversionPaymentMethod: PaymentMethod = 'CASH';
  protected conversionPaymentAmount = '';
  protected conversionPaymentReference = '';
  private lineKey = 1;

  ngOnInit(): void {
    this.loadLookups();
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
          items: quote.items.map(item => ({ key: this.nextLineKey(), productId: item.productId, quantity: item.quantity })),
        };
        this.detail.set(null);
        this.formOpen.set(true);
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected closeForm(): void { if (!this.actionLoading()) { this.formOpen.set(false); this.editing.set(null); this.error.set(null); } }
  protected addLine(): void { this.form.items.push({ key: this.nextLineKey(), productId: '', quantity: '1' }); }
  protected removeLine(key: number): void { if (this.form.items.length > 1) this.form.items = this.form.items.filter(item => item.key !== key); }

  protected submitQuote(event: Event): void {
    event.preventDefault();
    const validation = validateQuoteForm(this.form);
    if (validation) { this.error.set(validation); return; }
    const editing = this.editing();
    let request$: Observable<QuoteDetail>;
    const items = this.form.items.map(item => ({ productId: item.productId, quantity: item.quantity.trim() }));
    if (editing) {
      const request: UpdateQuoteRequest = {
        expirationDate: this.form.expirationDate,
        discountAmount: this.form.discountAmount.trim() || '0',
        notes: this.form.notes.trim(),
        items,
      };
      request$ = this.commercial.updateQuote(editing.id, request);
    } else {
      const request: CreateQuoteRequest = {
        customerId: this.form.customerId,
        expirationDate: this.form.expirationDate,
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
    this.conversionPaymentMethod = 'CASH';
    this.conversionPaymentAmount = '';
    this.conversionPaymentReference = '';
    this.error.set(null);
  }

  protected submitConversion(event: Event): void {
    event.preventDefault();
    const quote = this.convertQuote();
    if (!quote) return;
    let payment: PaymentRequest | undefined;
    if (this.conversionPaymentEnabled) {
      const error = validatePayment(this.conversionPaymentMethod, this.conversionPaymentAmount, this.conversionPaymentReference);
      if (error) { this.error.set(error); return; }
      payment = {
        method: this.conversionPaymentMethod,
        amount: this.conversionPaymentAmount.trim(),
        ...(this.conversionPaymentReference.trim() ? { reference: this.conversionPaymentReference.trim() } : {}),
      };
    }
    this.actionLoading.set(true);
    this.commercial.createSaleFromQuote(quote.id, payment).pipe(take(1), finalize(() => this.actionLoading.set(false))).subscribe({
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
  protected lineTotal(line: QuoteFormLine): number { return Number(this.productFor(line.productId)?.salePrice ?? 0) * Number(line.quantity || 0); }
  protected previewSubtotal(): number { return this.form.items.reduce((sum, line) => sum + this.lineTotal(line), 0); }
  protected previewTotal(): number { return Math.max(0, this.previewSubtotal() - Number(this.form.discountAmount || 0)); }
  protected formatMoney(value: string | number): string { return money(value); }
  protected formatDate(value: string): string { return shortDate(value); }
  protected range(): string { return pageRange(this.result()); }
  protected methodLabel(method: PaymentMethod): string { return PAYMENT_METHOD_LABELS[method]; }
  protected statusLabel(status: QuoteStatus): string { return { PENDING: 'Pendiente', ACCEPTED: 'Aceptada', REJECTED: 'Rechazada', EXPIRED: 'Vencida', CONVERTED: 'Convertida' }[status]; }
  protected statusClass(status: QuoteStatus): string { return status === 'ACCEPTED' ? 'badge--ok' : status === 'PENDING' ? 'badge--warn' : status === 'CONVERTED' ? 'badge--info' : status === 'REJECTED' ? 'badge--danger' : 'badge--neutral'; }
  protected canConvert(status: QuoteStatus): boolean { return this.canWrite() && ['PENDING', 'ACCEPTED'].includes(status); }
  protected visibleStatusCount(status: QuoteStatus): number { return this.result()?.data.filter(quote => quote.status === status).length ?? 0; }

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

  private nextLineKey(): number { return this.lineKey++; }
}

function emptyQuoteForm(key = 1): QuoteForm {
  const expiration = new Date(); expiration.setDate(expiration.getDate() + 15);
  return { customerId: '', expirationDate: expiration.toISOString().slice(0, 10), discountAmount: '0', notes: '', items: [{ key, productId: '', quantity: '1' }] };
}

function validateQuoteForm(form: QuoteForm): string | null {
  if (!form.customerId) return 'Selecciona un cliente.';
  if (!form.expirationDate) return 'Selecciona la fecha de vigencia.';
  if (!validAmount(form.discountAmount || '0', true)) return 'El descuento debe ser un monto válido con máximo 2 decimales.';
  if (!form.items.length || form.items.some(item => !item.productId)) return 'Selecciona un producto o servicio en cada línea.';
  if (form.items.some(item => !validQuantity(item.quantity))) return 'Cada cantidad debe ser mayor que cero y tener máximo 3 decimales.';
  if (new Set(form.items.map(item => item.productId)).size !== form.items.length) return 'No repitas productos; ajusta la cantidad en una sola línea.';
  return null;
}

function validatePayment(method: PaymentMethod, amount: string, reference: string): string | null {
  if (!validAmount(amount)) return 'El pago debe ser mayor que cero y tener máximo 2 decimales.';
  if (requiresPaymentReference(method) && !reference.trim()) return 'Ingresa la referencia del pago.';
  return null;
}
