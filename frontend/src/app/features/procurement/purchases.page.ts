import { MoneyInputDirective } from '../../shared/money-input.directive';
import { DateInputComponent } from '../../shared/date-input.component';
import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, input, output } from '@angular/core';
import { SettingsService } from '../settings/settings.service';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { CatalogService } from '../catalog/catalog.service';
import { ProductListItem } from '../catalog/catalog.model';
import { shortDate, money, requestErrorMessage } from '../commercial/commercial.util';
import { ProcurementService } from './procurement.service';
import { PurchaseInvoice, PurchaseInvoiceLineRequest, PurchaseReceiptsSummary, SavePurchaseInvoiceRequest, Supplier } from './procurement.model';
import { LocationOption, LocationsService } from '../inventory/locations.service';
import { CatalogPage } from '../catalog/catalog.page';
import { SuppliersPage } from './suppliers.page';
import { PurchaseDocumentsComponent } from './purchase-documents.component';
import { CurrencySelectComponent } from '../../shared/currency-select.component';
import { pendingReceiptLines, purchaseReceiptLines, purchaseReceptionState } from './purchase-receipt.util';

interface PurchaseForm extends SavePurchaseInvoiceRequest { lines: PurchaseInvoiceLineRequest[] }

@Component({
  selector: 'app-purchases', imports: [MoneyInputDirective, DateInputComponent, FormsModule, CatalogPage, SuppliersPage, PurchaseDocumentsComponent, CurrencySelectComponent], templateUrl: './purchases.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './procurement.scss'], changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchasesPage implements OnInit {
  readonly createOnly = input(false);
  readonly created = output<PurchaseInvoice>();
  readonly dismissed = output<void>();
  private readonly settingsApi = inject(SettingsService);
  protected readonly baseCurrency = signal('');
  protected readonly taxEnabled = signal<boolean | null>(null);
  private readonly api = inject(ProcurementService);
  private readonly supplierRequests = new Set<string>();
  private readonly catalog = inject(CatalogService);
  private readonly locationsApi = inject(LocationsService);
  protected readonly auth = inject(AuthService);
  protected readonly canDraft = computed(() => ['ADMIN', 'PURCHASING'].includes(this.auth.role()));
  protected readonly canApprove = computed(() => ['ADMIN', 'MANAGEMENT', 'PURCHASING'].includes(this.auth.role()));
  protected readonly canReceive = computed(() => ['ADMIN', 'PURCHASING'].includes(this.auth.role()));
  protected readonly canCancelReceipt = computed(() => this.canReceive());
  protected readonly result = signal<PaginatedResponse<PurchaseInvoice> | null>(null);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly products = signal<ProductListItem[]>([]);
  protected readonly selected = signal<PurchaseInvoice | null>(null);
  protected readonly receiptSummary = signal<PurchaseReceiptsSummary | null>(null);
  protected readonly receiptLoading = signal(false);
  private detailRequest = 0;
  protected readonly pendingReceipts = computed(() => pendingReceiptLines(this.selected(), this.receiptSummary()));
  protected readonly receptionState = computed(() => purchaseReceptionState(this.selected(), this.receiptSummary()));
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = visibleErrorSignal();
  protected readonly notice = signal<string | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly creatingProductFor = signal<PurchaseInvoiceLineRequest | null>(null);
  protected readonly creatingSupplier = signal(false);
  protected readonly canCreateProduct = computed(() => this.auth.role() === 'ADMIN');
  protected supplierCreated(item: Supplier): void {
    this.suppliers.update(items => [...items, item]); this.form.supplierId = item.id; this.creatingSupplier.set(false);
  }
  protected productCreated(id: string): void {
    const line = this.creatingProductFor();
    this.catalog.getProduct(id).pipe(take(1)).subscribe({ next: product => {
      this.products.update(items => [...items.filter(item => item.id !== id), product]);
      if (line && this.form.lines.includes(line)) { line.productId = id; this.productChanged(line); }
      this.creatingProductFor.set(null);
    }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected readonly editingId = signal<string | null>(null);
  protected readonly receiptOpen = signal(false);
  protected status = '';
  protected supplierId = '';
  protected search = '';
  protected form: PurchaseForm = emptyPurchaseForm();
  protected receiptDate = today();
  protected receiptNotes = '';
  protected receiptQuantities: Record<string, string> = {};
  protected receiptLocationIds: Record<string, string> = {};
  protected readonly locationOptions = signal<LocationOption[]>([]);

  ngOnInit(): void {
    if (this.createOnly()) this.openCreate();
    if (this.canDraft()) this.settingsApi.getPosConfiguration().pipe(take(1)).subscribe({ next: settings => {
      this.baseCurrency.set(settings.currencyCode); this.taxEnabled.set(settings.taxEnabled);
      if (!this.editingId() && !this.form.currencyCode) { this.form.currencyCode = settings.currencyCode; this.form.exchangeRate = '1'; }
      if (!settings.taxEnabled) this.form.lines.forEach(line => { if (line.taxCategory === 'TAXED') line.taxCategory = 'UNAFFECTED'; });
    }, error: error => this.error.set(requestErrorMessage(error)) });
    if (this.canReceive()) this.locationsApi.activeLocations().pipe(take(1)).subscribe({ next: locations => this.locationOptions.set(locations), error: error => this.error.set(requestErrorMessage(error)) });
    const suppliers$ = this.api.listSuppliers({ page: 1, limit: 100, status: 'ACTIVE' });
    if (this.canDraft()) {
      forkJoin({ suppliers: suppliers$, products: this.catalog.listProducts({ page: 1, limit: 100, status: 'ACTIVE' }) }).pipe(take(1)).subscribe({
        next: ({ suppliers, products }) => { this.suppliers.set(suppliers.data); this.products.set(products.data); },
        error: error => this.error.set(requestErrorMessage(error)),
      });
    } else {
      suppliers$.pipe(take(1)).subscribe({
        next: suppliers => this.suppliers.set(suppliers.data),
        error: error => this.error.set(requestErrorMessage(error)),
      });
    }
    this.load();
  }
  protected load(page = 1): void {
    this.loading.set(true); this.error.set(null);
    this.api.listPurchases({ page, limit: 20, status: this.status, supplierId: this.supplierId, search: this.search }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: value => { this.result.set(value); value.data.forEach(invoice => this.ensureSupplierName(invoice.supplierId)); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected apply(event: Event): void { event.preventDefault(); this.load(1); }
  protected clear(): void { this.status = ''; this.supplierId = ''; this.search = ''; this.load(1); }
  protected openCreate(): void { this.editingId.set(null); this.form = { ...emptyPurchaseForm(), currencyCode: this.baseCurrency(), exchangeRate: '1', exchangeRateDate: today() }; if (this.taxEnabled() === false) this.form.lines[0].taxCategory = 'UNAFFECTED'; this.formOpen.set(true); }
  protected closeForm(): void { if (this.saving()) return; this.formOpen.set(false); if (this.createOnly()) this.dismissed.emit(); }
  protected currencyChanged(): void { this.form.currencyCode = this.form.currencyCode?.trim().toUpperCase(); this.form.exchangeRate = this.form.currencyCode === this.baseCurrency() ? '1' : ''; }
  protected openEdit(item: PurchaseInvoice): void {
    if (!this.canDraft() || item.status !== 'DRAFT') return;
    this.editingId.set(item.id);
    this.form = {
      currencyCode: item.currencyCode, exchangeRate: item.exchangeRate, exchangeRateDate: item.exchangeRateDate,
      supplierId: item.supplierId, documentType: item.documentType, documentSeries: item.documentSeries ?? '',
      documentNumber: item.documentNumber, issueDate: item.issueDate, registrationDate: item.registrationDate,
      accountingDate: item.accountingDate, dueDate: item.dueDate ?? '', paymentTermsDays: item.paymentTermsDays ?? undefined,
      lines: item.lines.map(line => ({ productId: line.productId ?? '', description: line.descriptionSnapshot,
        unitLabel: line.unitNameSnapshot ?? line.unitCodeSnapshot ?? '', acquisitionKind: line.acquisitionKind, purchasePurpose: line.purchasePurpose,
        quantity: line.quantity, unitCost: line.unitCost, taxCategory: line.taxCategory,
        taxBasis: line.taxBasis ?? undefined, creditableTaxAmount: line.creditableTaxAmount })),
    };
    this.selected.set(null);
    this.formOpen.set(true);
  }
  protected addLine(): void { const line = emptyLine(); if (this.taxEnabled() === false) line.taxCategory = 'UNAFFECTED'; this.form.lines.push(line); }
  protected removeLine(index: number): void { this.form.lines.splice(index, 1); if (!this.form.lines.length) this.addLine(); }
  protected productChanged(line: PurchaseInvoiceLineRequest): void {
    const product = this.products().find(item => item.id === line.productId);
    if (product) { line.description = product.name; line.acquisitionKind = product.productType === 'SERVICE' ? 'SERVICE' : 'GOOD'; }
  }
  protected save(): void {
    if (!this.baseCurrency()) { this.error.set('Espera a que termine de cargar la configuración de la compra.'); return; }
    if (!this.form.supplierId || !this.form.documentNumber || !this.form.issueDate || !this.form.lines.length) { this.error.set('Completa proveedor, documento, fecha y al menos una línea.'); return; }
    if (this.form.currencyCode && (!/^[A-Z]{3}$/.test(this.form.currencyCode) || !(Number(this.form.exchangeRate) > 0))) { this.error.set('Indica una moneda de tres letras y un tipo de cambio mayor a cero.'); return; }
    const lines = this.form.lines.map(line => ({ ...line, productId: line.productId || undefined, description: line.description?.trim() || undefined, unitLabel: line.unitLabel?.trim() || undefined, taxBasis: line.taxCategory === 'TAXED' ? line.taxBasis : undefined, creditableTaxAmount: line.creditableTaxAmount || '0.00' }));
    const body: SavePurchaseInvoiceRequest = { ...this.form, documentSeries: this.form.documentSeries?.trim() || undefined, registrationDate: this.form.registrationDate || undefined, accountingDate: this.form.accountingDate || undefined, dueDate: this.form.dueDate || undefined, paymentTermsDays: this.form.paymentTermsDays || undefined, lines };
    this.saving.set(true); this.error.set(null);
    const request = this.editingId()
      ? this.api.updatePurchase(this.editingId()!, { ...body, supplierId: undefined })
      : this.api.createPurchase(body);
    request.pipe(take(1), finalize(() => this.saving.set(false))).subscribe({ next: item => { this.formOpen.set(false); this.editingId.set(null); if (this.createOnly()) { this.created.emit(item); return; } this.notice.set('Factura de compra guardada como borrador.'); this.load(); this.openDetail(item.id); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected openDetail(id: string): void {
    const request = ++this.detailRequest;
    this.receiptLoading.set(true); this.receiptSummary.set(null);
    forkJoin({ invoice: this.api.getPurchase(id), receipts: this.api.getReceipts(id) }).pipe(take(1), finalize(() => { if (request === this.detailRequest) this.receiptLoading.set(false); })).subscribe({ next: ({ invoice, receipts }) => { if (request !== this.detailRequest) return; this.selected.set(invoice); this.receiptSummary.set(receipts); }, error: error => { if (request === this.detailRequest) this.error.set(requestErrorMessage(error)); } });
  }
  protected closeDetail(): void { if (this.saving()) return; this.detailRequest++; this.receiptLoading.set(false); this.receiptOpen.set(false); this.selected.set(null); this.receiptSummary.set(null); }
  protected confirm(item: PurchaseInvoice): void {
    if (!confirm('¿Confirmar esta factura? Después ya no podrá editarse y se reconocerá contablemente.')) return;
    this.saving.set(true);
    this.api.confirmPurchase(item.id).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({ next: () => { this.notice.set('Factura confirmada.'); this.load(); this.openDetail(item.id); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected cancel(item: PurchaseInvoice): void {
    const reason = prompt('Motivo de la anulación:')?.trim(); if (!reason) return;
    this.api.cancelPurchase(item.id, reason).pipe(take(1)).subscribe({ next: () => { this.notice.set('Factura anulada.'); this.load(); this.openDetail(item.id); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected openReceipt(): void {
    const summary = this.receiptSummary(); if (!summary || !this.canReceive() || this.selected()?.status !== 'CONFIRMED' || this.receiptLoading() || this.saving() || !this.pendingReceipts().length) return;
    this.receiptDate = today(); this.receiptNotes = ''; this.receiptQuantities = {}; this.receiptLocationIds = {};
    for (const line of this.pendingReceipts()) this.receiptQuantities[line.purchaseInvoiceLineId] = line.pendingQuantity;
    this.receiptOpen.set(true);
  }
  protected saveReceipt(): void {
    const invoice = this.selected(), summary = this.receiptSummary();
    if (!invoice || !summary || !this.canReceive() || invoice.status !== 'CONFIRMED' || this.saving() || this.receiptLoading()) return;
    let lines;
    try { lines = purchaseReceiptLines(invoice, summary, this.receiptQuantities, this.receiptLocationIds); }
    catch (error) { this.error.set((error as Error).message); return; }
    this.saving.set(true);
    this.api.createReceipt(invoice.id, { receivedDate: this.receiptDate, notes: this.receiptNotes.trim() || undefined, idempotencyKey: crypto.randomUUID(), lines }).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({ next: () => { this.receiptOpen.set(false); this.notice.set('Recepción registrada e inventario actualizado.'); this.openDetail(invoice.id); }, error: error => { this.error.set(requestErrorMessage(error)); this.openDetail(invoice.id); } });
  }
  protected cancelReceipt(id: string): void { const reason = prompt('Motivo para anular la recepción:')?.trim(); if (!reason) return; this.api.cancelReceipt(id, reason).pipe(take(1)).subscribe({ next: () => { this.notice.set('Recepción anulada.'); this.openDetail(this.selected()!.id); }, error: error => this.error.set(requestErrorMessage(error)) }); }
  private ensureSupplierName(id: string): void {
    if (this.api.cachedSupplier(id) || this.supplierRequests.has(id)) return;
    this.supplierRequests.add(id);
    this.api.getSupplier(id).pipe(take(1), finalize(() => this.supplierRequests.delete(id))).subscribe({ error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected supplierName(id: string): string { return this.api.cachedSupplier(id)?.legalName ?? this.suppliers().find(item => item.id === id)?.legalName ?? 'Consultando proveedor…'; }
  protected invoiceLine(id: string) { return this.selected()?.lines.find(item => item.id === id); }
  protected formatMoney(value: string | number, currency = this.baseCurrency()): string { return currency ? money(value, currency) : Number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  protected formatCost(value: string, currency: string): string { return new Intl.NumberFormat('es-PE', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Number(value)); }
  protected formatDate(value: string): string { return shortDate(value); }
  protected previous(): void { const page = this.result()?.page ?? 1; if (page > 1) this.load(page - 1); }
  protected next(): void { const r = this.result(); if (r && r.page < r.totalPages) this.load(r.page + 1); }
}

function today(): string { return new Date().toISOString().slice(0, 10); }
function emptyLine(): PurchaseInvoiceLineRequest { return { productId: '', description: '', unitLabel: '', acquisitionKind: 'GOOD', purchasePurpose: 'RESALE_INVENTORY', quantity: '1', unitCost: '0.00', taxCategory: 'TAXED', taxBasis: 'TAX_EXCLUDED', creditableTaxAmount: '0.00' }; }
function emptyPurchaseForm(): PurchaseForm { const date = today(); return { supplierId: '', documentType: 'FACTURA', documentSeries: '', documentNumber: '', issueDate: date, registrationDate: date, accountingDate: date, dueDate: '', paymentTermsDays: undefined, lines: [emptyLine()] }; }
