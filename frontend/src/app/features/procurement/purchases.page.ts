import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { CatalogService } from '../catalog/catalog.service';
import { ProductListItem } from '../catalog/catalog.model';
import { shortDate, money, requestErrorMessage } from '../commercial/commercial.util';
import { ProcurementService } from './procurement.service';
import { PurchaseInvoice, PurchaseInvoiceLineRequest, PurchaseReceiptsSummary, SavePurchaseInvoiceRequest, Supplier } from './procurement.model';

interface PurchaseForm extends SavePurchaseInvoiceRequest { lines: PurchaseInvoiceLineRequest[] }

@Component({
  selector: 'app-purchases', imports: [FormsModule], templateUrl: './purchases.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './procurement.scss'], changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchasesPage implements OnInit {
  private readonly api = inject(ProcurementService);
  private readonly catalog = inject(CatalogService);
  protected readonly auth = inject(AuthService);
  protected readonly canWrite = computed(() => this.auth.role() === 'ADMIN');
  protected readonly result = signal<PaginatedResponse<PurchaseInvoice> | null>(null);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly products = signal<ProductListItem[]>([]);
  protected readonly selected = signal<PurchaseInvoice | null>(null);
  protected readonly receiptSummary = signal<PurchaseReceiptsSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly receiptOpen = signal(false);
  protected status = '';
  protected supplierId = '';
  protected search = '';
  protected form: PurchaseForm = emptyPurchaseForm();
  protected receiptDate = today();
  protected receiptNotes = '';
  protected receiptQuantities: Record<string, string> = {};

  ngOnInit(): void {
    const suppliers$ = this.api.listSuppliers({ page: 1, limit: 100, status: 'ACTIVE' });
    if (this.canWrite()) {
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
    this.api.listPurchases({ page, limit: 20, status: this.status, supplierId: this.supplierId, search: this.search }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: value => this.result.set(value), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected apply(event: Event): void { event.preventDefault(); this.load(1); }
  protected clear(): void { this.status = ''; this.supplierId = ''; this.search = ''; this.load(1); }
  protected openCreate(): void { this.form = emptyPurchaseForm(); this.formOpen.set(true); }
  protected addLine(): void { this.form.lines.push(emptyLine()); }
  protected removeLine(index: number): void { this.form.lines.splice(index, 1); if (!this.form.lines.length) this.addLine(); }
  protected productChanged(line: PurchaseInvoiceLineRequest): void {
    const product = this.products().find(item => item.id === line.productId);
    if (product) { line.description = product.name; line.acquisitionKind = product.productType === 'SERVICE' ? 'SERVICE' : 'GOOD'; }
  }
  protected save(): void {
    if (!this.form.supplierId || !this.form.documentNumber || !this.form.issueDate || !this.form.lines.length) { this.error.set('Completa proveedor, documento, fecha y al menos una línea.'); return; }
    const lines = this.form.lines.map(line => ({ ...line, productId: line.productId || undefined, description: line.description?.trim() || undefined, unitLabel: line.unitLabel?.trim() || undefined, taxBasis: line.taxCategory === 'TAXED' ? line.taxBasis : undefined, creditableTaxAmount: line.creditableTaxAmount || '0.00' }));
    const body: SavePurchaseInvoiceRequest = { ...this.form, documentSeries: this.form.documentSeries?.trim() || undefined, registrationDate: this.form.registrationDate || undefined, accountingDate: this.form.accountingDate || undefined, dueDate: this.form.dueDate || undefined, paymentTermsDays: this.form.paymentTermsDays || undefined, lines };
    this.saving.set(true); this.error.set(null);
    this.api.createPurchase(body).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({ next: item => { this.formOpen.set(false); this.notice.set('Factura de compra guardada como borrador.'); this.load(); this.openDetail(item.id); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected openDetail(id: string): void {
    this.error.set(null);
    forkJoin({ invoice: this.api.getPurchase(id), receipts: this.api.getReceipts(id) }).pipe(take(1)).subscribe({ next: ({ invoice, receipts }) => { this.selected.set(invoice); this.receiptSummary.set(receipts); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected closeDetail(): void { this.selected.set(null); this.receiptSummary.set(null); }
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
    const summary = this.receiptSummary(); if (!summary) return;
    this.receiptDate = today(); this.receiptNotes = ''; this.receiptQuantities = {};
    for (const line of summary.lines) if (Number(line.pendingQuantity) > 0) this.receiptQuantities[line.purchaseInvoiceLineId] = line.pendingQuantity;
    this.receiptOpen.set(true);
  }
  protected saveReceipt(): void {
    const invoice = this.selected(); if (!invoice) return;
    const lines = Object.entries(this.receiptQuantities).filter(([, quantity]) => Number(quantity) > 0).map(([purchaseInvoiceLineId, quantity]) => ({ purchaseInvoiceLineId, quantity }));
    if (!lines.length) { this.error.set('Ingresa al menos una cantidad recibida.'); return; }
    this.saving.set(true);
    this.api.createReceipt(invoice.id, { receivedDate: this.receiptDate, notes: this.receiptNotes.trim() || undefined, idempotencyKey: crypto.randomUUID(), lines }).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({ next: () => { this.receiptOpen.set(false); this.notice.set('Recepción registrada e inventario actualizado.'); this.openDetail(invoice.id); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected cancelReceipt(id: string): void { const reason = prompt('Motivo para anular la recepción:')?.trim(); if (!reason) return; this.api.cancelReceipt(id, reason).pipe(take(1)).subscribe({ next: () => { this.notice.set('Recepción anulada.'); this.openDetail(this.selected()!.id); }, error: error => this.error.set(requestErrorMessage(error)) }); }
  protected supplierName(id: string): string { return this.suppliers().find(item => item.id === id)?.legalName ?? 'Proveedor'; }
  protected invoiceLine(id: string) { return this.selected()?.lines.find(item => item.id === id); }
  protected formatMoney(value: string | number): string { return money(value); }
  protected formatDate(value: string): string { return shortDate(value); }
  protected previous(): void { const page = this.result()?.page ?? 1; if (page > 1) this.load(page - 1); }
  protected next(): void { const r = this.result(); if (r && r.page < r.totalPages) this.load(r.page + 1); }
}

function today(): string { return new Date().toISOString().slice(0, 10); }
function emptyLine(): PurchaseInvoiceLineRequest { return { productId: '', description: '', unitLabel: '', acquisitionKind: 'GOOD', purchasePurpose: 'RESALE_INVENTORY', quantity: '1', unitCost: '0.00', taxCategory: 'TAXED', taxBasis: 'TAX_EXCLUDED', creditableTaxAmount: '0.00' }; }
function emptyPurchaseForm(): PurchaseForm { const date = today(); return { supplierId: '', documentType: 'FACTURA', documentSeries: '', documentNumber: '', issueDate: date, registrationDate: date, accountingDate: date, dueDate: '', paymentTermsDays: undefined, lines: [emptyLine()] }; }
