import { MoneyInputDirective } from '../../shared/money-input.directive';
import { DateInputComponent } from '../../shared/date-input.component';
import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EMPTY, Observable, expand, finalize, forkJoin, from, map, mergeMap, of, reduce, switchMap, take, toArray } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { ProductListItem } from '../catalog/catalog.model';
import { CatalogService } from '../catalog/catalog.service';
import { money, quantity, requestErrorMessage, shortDate } from '../commercial/commercial.util';
import { PurchaseInvoice, PurchaseReceiptLine, Supplier } from '../procurement/procurement.model';
import { ProcurementService } from '../procurement/procurement.service';
import {
  AllocateImportExpenseRequest, ImportExpense, ImportExpenseAllocationBatch, ImportExpenseAllocationMethod,
  ImportExpenseAllocationPreview, ImportExpenseCategory, ImportOperation, ImportOperationStatus, ImportShipment,
  ImportShipmentLine, ImportShipmentLineRequest, SaveImportExpenseRequest, SaveImportOperationRequest,
  SaveImportShipmentRequest, ShipmentLineReceptionSummary,
} from './imports.model';
import { ImportsService } from './imports.service';
import { CountrySelectComponent } from '../../shared/country-select.component';
import { PurchasesPage } from '../procurement/purchases.page';
import { RouterLink } from '@angular/router';
import { ImportIncoterm } from './imports.model';
import { operationPayload as cleanOperation, shipmentPayload as cleanShipment } from './import-payload.util';
import { PurchaseDocumentsComponent } from '../procurement/purchase-documents.component';
import { ImportReceivingComponent } from './import-receiving.component';
import { CurrencySelectComponent } from '../../shared/currency-select.component';
import { operationIsOpen, operationCanCancel, shipmentActionAllowed } from './import-workflow.util';
import type { ReceivingSummary } from './import-receiving.model';
import { shipmentQuantityLimit, shipmentQuantityError, shipmentLineIsLocked } from './shipment-quantity.util';
import { purchaseCanStartImport } from './import-purchase-eligibility.util';

interface OperationForm extends SaveImportOperationRequest { id?: string; reference?: string }
interface ShipmentForm extends SaveImportShipmentRequest { id?: string }
interface ExpenseForm extends SaveImportExpenseRequest { id?: string }
interface ReceiptOption { id: string; receiptId: string; date: string; quantity: string }

@Component({
  selector: 'app-imports',
  imports: [MoneyInputDirective, DateInputComponent, FormsModule, CountrySelectComponent, PurchasesPage, RouterLink, PurchaseDocumentsComponent, ImportReceivingComponent, CurrencySelectComponent],
  templateUrl: './imports.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './imports.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportsPage implements OnInit {
  private readonly api = inject(ImportsService);
  private readonly catalogApi = inject(CatalogService);
  private readonly procurementApi = inject(ProcurementService);
  protected readonly auth = inject(AuthService);
  protected readonly canWrite = computed(() => ['ADMIN', 'PURCHASING'].includes(this.auth.role()));
  protected readonly detailLoading = signal(false);
  private readonly detailReady = signal(false);
  protected readonly canChange = computed(() => this.canWrite() && this.detailReady() && operationIsOpen(this.selected()) && !this.detailLoading() && !this.saving());
  protected readonly canCancelOperation = computed(() => this.canChange() && operationCanCancel(this.selected(), this.receivingSummary()?.shipments ?? this.shipments()));
  private readonly receivingSummary = signal<ReceivingSummary | null>(null);
  private detailVersion = 0;
  protected readonly creatingPurchase = signal(false);
  protected readonly pendingCompletion = signal(false);
  protected readonly pendingShipmentAction = signal<{ kind: 'depart' | 'arrive'; shipment: ImportShipment } | null>(null);
  protected readonly choosingPurchase = signal<PurchaseInvoice | null>(null);
  protected readonly eligiblePurchases = signal<PurchaseInvoice[]>([]);
  protected readonly purchasesLoading = signal(false);
  protected readonly checkingPurchase = signal(false);
  private purchaseListVersion = 0;
  private purchaseSelectionVersion = 0;
  private readonly supplierRequests = new Set<string>();
  protected readonly incoterms: ImportIncoterm[] = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'];
  protected purchaseCreated(item: PurchaseInvoice): void {
    this.ensureSupplier(item.supplierId);
    this.purchases.update(items => [...items, item]); this.operationForm.purchaseInvoiceId = item.id;
    this.eligiblePurchases.update(items => [...items.filter(invoice => invoice.id !== item.id), item]);
    this.choosingPurchase.set(item); this.creatingPurchase.set(false); this.loadImportPurchases();
  }
  protected choosePurchase(): void {
    const version = ++this.purchaseSelectionVersion;
    this.choosingPurchase.set(null);
    const id = this.operationForm.purchaseInvoiceId; if (!id) { this.checkingPurchase.set(false); return; }
    this.checkingPurchase.set(true);
    this.procurementApi.getPurchase(id).pipe(switchMap(invoice => this.withInvoiceSupplier(invoice)), switchMap(invoice => this.purchaseImportable(invoice).pipe(map(allowed => ({ invoice, allowed })))), take(1), finalize(() => { if (version === this.purchaseSelectionVersion) this.checkingPurchase.set(false); })).subscribe({ next: ({ invoice, allowed }) => {
      if (version !== this.purchaseSelectionVersion || this.operationForm.purchaseInvoiceId !== id) return;
      if (!allowed) { this.operationForm.purchaseInvoiceId = ''; this.error.set('Esta compra ya no tiene mercadería disponible para una nueva importación.'); this.loadImportPurchases(); return; }
      this.ensureSupplier(invoice.supplierId);
      this.choosingPurchase.set(invoice);
    }, error: error => { if (version === this.purchaseSelectionVersion) this.error.set(requestErrorMessage(error)); } });
  }
  private purchaseImportable(invoice: PurchaseInvoice): Observable<boolean> {
    if (invoice.status !== 'CONFIRMED') return of(purchaseCanStartImport(invoice, null));
    return this.procurementApi.getReceipts(invoice.id).pipe(switchMap(receipts => {
      if (!purchaseCanStartImport(invoice, receipts)) return of(false);
      return this.api.listOperations({ purchaseInvoiceId: invoice.id, page: 1, limit: 1 }).pipe(switchMap(result => result.data.length
        ? this.api.getOperation(result.data[0].id).pipe(map(operation => purchaseCanStartImport(invoice, receipts, operation.invoiceLines)))
        : of(true)));
    }));
  }
  private withInvoiceSupplier(invoice: PurchaseInvoice): Observable<PurchaseInvoice> {
    const cached = this.procurementApi.cachedSupplier(invoice.supplierId);
    return (cached ? of(cached) : this.procurementApi.getSupplier(invoice.supplierId)).pipe(map(supplier => {
      this.suppliers.update(items => [...items.filter(item => item.id !== supplier.id), supplier]);
      return invoice;
    }));
  }
  protected loadImportPurchases(): void {
    const version = ++this.purchaseListVersion;
    this.purchasesLoading.set(true); this.eligiblePurchases.set([]);
    this.procurementApi.listPurchases({ page: 1, limit: 100 }).pipe(
      expand(result => result.page < result.totalPages ? this.procurementApi.listPurchases({ page: result.page + 1, limit: 100 }) : EMPTY),
      reduce((items, result) => [...items, ...result.data], [] as PurchaseInvoice[]),
      switchMap(invoices => from(invoices).pipe(mergeMap(invoice => this.purchaseImportable(invoice).pipe(switchMap(allowed => allowed ? this.withInvoiceSupplier(invoice).pipe(map(resolved => ({ invoice: resolved, allowed }))) : of({ invoice, allowed }))), 6), toArray())),
      finalize(() => { if (version === this.purchaseListVersion) this.purchasesLoading.set(false); }),
    ).subscribe({ next: results => { if (version !== this.purchaseListVersion) return;
      const items = results.filter(result => result.allowed).map(result => result.invoice);
      this.eligiblePurchases.set(items);
      items.forEach(invoice => this.ensureSupplier(invoice.supplierId));
      if (this.operationForm.purchaseInvoiceId && !items.some(item => item.id === this.operationForm.purchaseInvoiceId)) { this.operationForm.purchaseInvoiceId = ''; this.choosingPurchase.set(null); }
    }, error: error => { if (version === this.purchaseListVersion) this.error.set(requestErrorMessage(error)); } });
  }
  protected incotermAllowed(term: ImportIncoterm): boolean { return this.shipmentForm.transportMode === 'SEA' || !['FAS', 'FOB', 'CFR', 'CIF'].includes(term); }
  protected transportChanged(): void { if (this.shipmentForm.incoterm && !this.incotermAllowed(this.shipmentForm.incoterm)) { this.shipmentForm.incoterm = null; this.shipmentForm.incotermNamedPlace = null; this.shipmentForm.incotermVersion = null; } }
  protected invoiceLabel(item: PurchaseInvoice): string { return `${item.documentSeries ? item.documentSeries + '-' : ''}${item.documentNumber} · ${this.supplierName(item.supplierId)} · ${item.currencyCode} · ${item.status === 'DRAFT' ? 'Borrador' : 'Confirmada'}`; }
  protected readonly result = signal<PaginatedResponse<ImportOperation> | null>(null);
  protected readonly selected = signal<ImportOperation | null>(null);
  protected readonly shipments = signal<ImportShipment[]>([]);
  protected readonly expenses = signal<ImportExpense[]>([]);
  protected readonly products = signal<ProductListItem[]>([]);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly purchases = signal<PurchaseInvoice[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = visibleErrorSignal();
  protected readonly notice = signal<string | null>(null);
  protected readonly operationFormOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly shipmentFormOpen = signal(false);
  protected readonly shipmentBudgetLoading = signal(false);
  private readonly shipmentBudgetReady = signal(false);
  private readonly shipmentBudget = signal<ImportOperation['invoiceLines']>(null);
  private shipmentBudgetVersion = 0;
  protected readonly expenseFormOpen = signal(false);
  protected readonly allocationOpen = signal(false);
  protected readonly receiptOpen = signal(false);
  protected readonly allocationPreview = signal<ImportExpenseAllocationPreview | null>(null);
  protected readonly allocationBatches = signal<ImportExpenseAllocationBatch[]>([]);
  protected readonly receiptSummary = signal<ShipmentLineReceptionSummary | null>(null);
  protected readonly receiptOptions = signal<ReceiptOption[]>([]);
  protected search = '';
  protected status: ImportOperationStatus | '' = '';
  protected operationForm: OperationForm = emptyOperation();
  protected shipmentForm: ShipmentForm = emptyShipment();
  protected expenseForm: ExpenseForm = emptyExpense();
  protected selectedExpense: ImportExpense | null = null;
  protected selectedShipmentLine: ImportShipmentLine | null = null;
  protected allocationMethod: ImportExpenseAllocationMethod = 'QUANTITY';
  protected allocationAmount = '';
  protected allocationLineIds: string[] = [];
  protected manualAmounts: Record<string, string> = {};
  protected receiptLineId = '';
  protected receiptQuantity = '';
  protected departureDate = today();
  protected arrivalDate = today();

  protected readonly categories: Array<{ value: ImportExpenseCategory; label: string }> = [
    { value: 'FREIGHT', label: 'Flete' }, { value: 'INSURANCE', label: 'Seguro' },
    { value: 'CUSTOMS_DUTY', label: 'Derechos aduaneros' }, { value: 'PORT_HANDLING', label: 'Gastos portuarios' },
    { value: 'STORAGE', label: 'Almacenaje' }, { value: 'INLAND_TRANSPORT', label: 'Transporte local' },
    { value: 'OTHER', label: 'Otro' },
  ];

  ngOnInit(): void {
    forkJoin({
      suppliers: this.procurementApi.listSuppliers({ page: 1, limit: 100, status: 'ACTIVE' }),
      purchases: this.procurementApi.listPurchases({ page: 1, limit: 100 }),
    }).pipe(take(1)).subscribe({
      next: ({ suppliers, purchases }) => {
        this.suppliers.set(suppliers.data); this.purchases.set(purchases.data.filter(item => item.status !== 'CANCELLED'));
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
    if (this.auth.role() !== 'ACCOUNTANT') {
      this.catalogApi.listProducts({ page: 1, limit: 100, status: 'ACTIVE' }).pipe(take(1)).subscribe({
        next: products => this.products.set(products.data),
        error: error => this.error.set(requestErrorMessage(error)),
      });
    }
    this.load();
  }

  protected load(page = 1): void {
    this.loading.set(true); this.error.set(null);
    this.api.listOperations({ page, limit: 20, search: this.search, status: this.status }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: value => this.result.set(value), error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected apply(event: Event): void { event.preventDefault(); this.load(1); }
  protected clear(): void { this.search = ''; this.status = ''; this.load(1); }
  protected previous(): void { const page = this.result()?.page ?? 1; if (page > 1) this.load(page - 1); }
  protected next(): void { const result = this.result(); if (result && result.page < result.totalPages) this.load(result.page + 1); }

  protected openCreateOperation(): void { this.purchaseSelectionVersion++; this.checkingPurchase.set(false); this.operationForm = emptyOperation(); this.choosingPurchase.set(null); this.operationFormOpen.set(true); this.loadImportPurchases(); }
  protected openEditOperation(): void {
    if (!this.canChange()) return;
    const item = this.selected(); if (!item) return;
    this.operationForm = { id: item.id, reference: item.reference, purchaseInvoiceId: item.purchaseInvoiceId ?? '', description: item.description ?? '', originCountry: item.originCountry, destinationCountry: item.destinationCountry, externalReference: item.externalReference ?? '', notes: item.notes ?? '' };
    this.operationFormOpen.set(true);
  }
  protected saveOperation(): void {
    if (this.saving() || (this.operationForm.id && !this.canChange())) return;
    if (!this.operationForm.id && (this.purchasesLoading() || this.checkingPurchase() || this.choosingPurchase()?.id !== this.operationForm.purchaseInvoiceId)) { this.error.set('Selecciona una compra disponible y espera a que termine su verificación.'); return; }
    if ((!this.operationForm.id && !this.operationForm.purchaseInvoiceId) || !countryValid(this.operationForm.originCountry) || !countryValid(this.operationForm.destinationCountry)) {
      this.error.set('Selecciona una compra y los países de origen y destino.'); return;
    }
    const body = cleanOperation(this.operationForm);
    const { purchaseInvoiceId, ...changes } = body;
    const request = this.operationForm.id ? this.api.updateOperation(this.operationForm.id, changes)
      : this.procurementApi.getPurchase(body.purchaseInvoiceId).pipe(switchMap(invoice => this.purchaseImportable(invoice)), switchMap(allowed => {
        if (!allowed) { this.operationForm.purchaseInvoiceId = ''; this.choosingPurchase.set(null); this.error.set('La compra ya está recibida o asignada por completo. Selecciona otra compra.'); this.loadImportPurchases(); return EMPTY; }
        return this.api.createOperation(body);
      }));
    this.saving.set(true); this.error.set(null);
    request.pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: item => { this.operationFormOpen.set(false); this.notice.set(this.operationForm.id ? 'Importación actualizada.' : 'Importación creada.'); this.load(); this.openDetail(item.id); },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected openDetail(id: string): void {
    const version = ++this.detailVersion;
    this.detailLoading.set(true); this.detailReady.set(false); this.receivingSummary.set(null);
    forkJoin({ operation: this.api.getOperation(id), shipments: this.api.listShipments(id), expenses: this.api.listExpenses(id), receiving: this.api.getReceivingSummary(id) }).pipe(take(1), finalize(() => { if (version === this.detailVersion) this.detailLoading.set(false); })).subscribe({
      next: ({ operation, shipments, expenses, receiving }) => {
        if (version !== this.detailVersion) return;
        this.receivingSummary.set(receiving);
        this.detailReady.set(true);
        this.selected.set(operation); this.shipments.set(shipments.data); this.expenses.set(expenses.data); this.detailOpen.set(true);
        if (operation.purchaseInvoiceId) this.procurementApi.getPurchase(operation.purchaseInvoiceId).pipe(take(1)).subscribe({ next: invoice => this.purchases.update(items => [...items.filter(item => item.id !== invoice.id), invoice]), error: error => this.error.set(requestErrorMessage(error)) });
      },
      error: error => { if (version === this.detailVersion) this.error.set(requestErrorMessage(error)); },
    });
  }
  protected refreshDetail(): void { const id = this.selected()?.id; if (id) this.openDetail(id); }
  protected closeDetail(): void { if (this.saving()) return; this.detailVersion++; this.detailLoading.set(false); this.detailOpen.set(false); this.selected.set(null); this.receivingSummary.set(null); }
  protected completeOperation(): void {
    if (!this.canChange() || this.selected()?.status !== 'IN_PROGRESS') return;
    if (!this.selected()?.isLegacyUnlinked && !this.receivingSummary()?.canComplete) { this.error.set('Todavía hay mercadería pendiente o embarques sin arribar. Actualiza la importación.'); return; }
    this.pendingCompletion.set(true);
  }
  protected confirmCompletion(): void {
    const item = this.selected(); if (!item || !this.canChange()) return;
    if (item.isLegacyUnlinked) { this.saveAndRefresh(this.api.completeOperation(item.id), 'Importación completada.', () => this.pendingCompletion.set(false)); return; }
    this.saving.set(true);
    this.api.getReceivingSummary(item.id).pipe(take(1)).subscribe({ next: summary => {
      this.saving.set(false); this.receivingSummary.set(summary);
      if (!summary.canComplete) { this.error.set('La importación ya no se puede completar: revisa los pendientes y los estados de los embarques.'); this.refreshDetail(); return; }
      this.saveAndRefresh(this.api.completeOperation(item.id), 'Importación completada.', () => this.pendingCompletion.set(false));
    }, error: error => { this.saving.set(false); this.error.set(requestErrorMessage(error)); } });
  }
  protected cancelOperation(): void {
    if (!this.canCancelOperation()) return;
    const item = this.selected(); const reason = prompt('Motivo de la anulación:')?.trim(); if (!item || !reason) return;
    this.run(this.api.cancelOperation(item.id, reason), 'Importación anulada.');
  }

  protected openCreateShipment(): void { if (!this.canChange()) return; this.shipmentForm = emptyShipment(); this.shipmentFormOpen.set(true); this.refreshShipmentBudget(); }
  protected openEditShipment(item: ImportShipment): void {
    if (!this.shipmentAllowed(item, 'edit')) return;
    this.shipmentForm = { id: item.id, incoterm: item.incoterm, incotermNamedPlace: item.incotermNamedPlace, incotermVersion: item.incotermVersion, transportMode: item.transportMode, carrierName: item.carrierName ?? '', trackingReference: item.trackingReference ?? '', billOfLadingNumber: item.billOfLadingNumber ?? '', containerReference: item.containerReference ?? '', originLocation: item.originLocation ?? '', destinationLocation: item.destinationLocation ?? '', estimatedDepartureDate: inputDate(item.estimatedDepartureDate), estimatedArrivalDate: inputDate(item.estimatedArrivalDate), notes: item.notes ?? '', lines: item.lines.map(line => lineRequest(line)) };
    this.shipmentFormOpen.set(true);
    this.refreshShipmentBudget();
  }
  protected refreshShipmentBudget(): void {
    const id = this.selected()?.id; if (!id) return;
    const version = ++this.shipmentBudgetVersion;
    this.shipmentBudgetReady.set(false); this.shipmentBudgetLoading.set(true);
    this.api.getOperation(id).pipe(take(1), finalize(() => { if (version === this.shipmentBudgetVersion) this.shipmentBudgetLoading.set(false); })).subscribe({ next: operation => {
      if (version !== this.shipmentBudgetVersion || this.selected()?.id !== id) return;
      this.shipmentBudget.set(operation.invoiceLines); this.shipmentBudgetReady.set(operationIsOpen(operation) && (operation.isLegacyUnlinked || operation.purchaseInvoice?.canAssignLines === true));
      if (!this.shipmentBudgetReady()) this.error.set('La importación o la compra ya no permiten registrar este embarque.');
    }, error: error => { if (version === this.shipmentBudgetVersion) this.error.set(requestErrorMessage(error)); } });
  }
  private originalShipmentLines(): ImportShipmentLine[] { return this.shipments().find(item => item.id === this.shipmentForm.id)?.lines ?? []; }
  protected shipmentMaximum(index: number): string | null { return this.shipmentBudgetReady() ? shipmentQuantityLimit(this.shipmentBudget(), this.shipmentForm.lines, this.originalShipmentLines(), index) : null; }
  protected shipmentLineLocked(line: ImportShipmentLineRequest): boolean { return this.shipmentBudgetReady() && shipmentLineIsLocked(this.shipmentBudget(), this.originalShipmentLines(), line); }
  protected shipmentOptionDisabled(index: number, invoiceLineId: string): boolean {
    if (this.shipmentForm.lines[index].purchaseInvoiceLineId === invoiceLineId) return false;
    if (!this.shipmentBudgetReady()) return true;
    const rows = this.shipmentForm.lines.map((line, position) => position === index ? { ...line, purchaseInvoiceLineId: invoiceLineId } : line);
    const maximum = shipmentQuantityLimit(this.shipmentBudget(), rows, this.originalShipmentLines(), index);
    return maximum !== null && Number(maximum) <= 0;
  }
  protected canAddShipmentLine(): boolean {
    if (!this.shipmentBudgetReady() || this.saving()) return false;
    if (this.selected()?.isLegacyUnlinked) return true;
    return this.shipmentBudget()?.some(line => Number(shipmentQuantityLimit(this.shipmentBudget(), [...this.shipmentForm.lines, { purchaseInvoiceLineId: line.purchaseInvoiceLineId, plannedQuantity: '0' }], this.originalShipmentLines(), this.shipmentForm.lines.length)) > 0) ?? false;
  }
  protected shipmentQuantityMessage(index: number): string | null { return this.shipmentBudgetReady() ? shipmentQuantityError(this.shipmentBudget(), this.shipmentForm.lines, this.originalShipmentLines(), index) : null; }
  protected shipmentQuantitiesValid(): boolean { return this.shipmentBudgetReady() && !this.shipmentForm.lines.some((_, index) => this.shipmentQuantityMessage(index)); }
  protected addShipmentLine(): void { if (this.canAddShipmentLine()) this.shipmentForm.lines.push(emptyShipmentLine()); }
  protected removeShipmentLine(index: number): void { if (this.shipmentLineLocked(this.shipmentForm.lines[index])) return; this.shipmentForm.lines.splice(index, 1); if (!this.shipmentForm.lines.length) this.shipmentForm.lines.push(emptyShipmentLine()); }
  protected shipmentProductChanged(line: ImportShipmentLineRequest): void {
    const product = this.products().find(item => item.id === line.productId); if (!product) return;
    line.descriptionSnapshot = product.name; line.unitCode = product.unit.code; line.unitName = product.unit.name;
  }
  protected purchaseLineChanged(line: ImportShipmentLineRequest): void {
    const purchaseLine = this.purchaseLines().find(item => item.id === line.purchaseInvoiceLineId); if (!purchaseLine) return;
    line.productId = purchaseLine.productId || undefined; line.descriptionSnapshot = purchaseLine.descriptionSnapshot;
    line.unitCode = purchaseLine.unitCodeSnapshot ?? undefined; line.unitName = purchaseLine.unitNameSnapshot ?? undefined;
  }
  protected saveShipment(): void {
    if (!this.canChange()) return;
    if (this.shipmentBudgetLoading() || !this.shipmentQuantitiesValid()) { this.error.set('Revisa las cantidades y el saldo disponible antes de guardar el embarque.'); return; }
    const operation = this.selected(); if (!operation) return;
    if (!operation.isLegacyUnlinked && (!operation.purchaseInvoice?.canAssignLines || this.shipmentForm.lines.some(line => !this.purchaseLines().some(item => item.id === line.purchaseInvoiceLineId)))) { this.error.set('Elige únicamente líneas de la compra vinculada y confirma primero la factura.'); return; }
    if (this.shipmentForm.incoterm && (!this.shipmentForm.incotermNamedPlace?.trim() || !this.incotermAllowed(this.shipmentForm.incoterm))) { this.error.set('Indica el lugar acordado y un INCOTERM compatible con el transporte.'); return; }
    if (this.shipmentForm.lines.some(line => !(Number(line.plannedQuantity) > 0) || !line.descriptionSnapshot?.trim())) { this.error.set('Completa la descripción y una cantidad mayor a cero en cada línea.'); return; }
    const validLines = this.shipmentForm.lines.filter(line => Number(line.plannedQuantity) > 0 && (line.productId || line.descriptionSnapshot?.trim()));
    if (!validLines.length) { this.error.set('Agrega al menos una línea con descripción y cantidad.'); return; }
    const body = cleanShipment({ ...this.shipmentForm, lines: validLines });
    const request = this.shipmentForm.id ? this.api.updateShipment(this.shipmentForm.id, body) : this.api.createShipment(operation.id, body);
    this.saveAndRefresh(request, this.shipmentForm.id ? 'Embarque actualizado.' : 'Embarque creado.', () => this.shipmentFormOpen.set(false));
  }
  protected shipmentAllowed(item: ImportShipment, action: 'edit' | 'depart' | 'arrive' | 'cancel'): boolean { return this.canChange() && shipmentActionAllowed(this.selected(), item, action); }
  protected depart(item: ImportShipment): void { if (this.shipmentAllowed(item, 'depart')) this.pendingShipmentAction.set({ kind: 'depart', shipment: item }); }
  protected arrive(item: ImportShipment): void { if (this.shipmentAllowed(item, 'arrive')) this.pendingShipmentAction.set({ kind: 'arrive', shipment: item }); }
  protected confirmShipmentAction(): void {
    const action = this.pendingShipmentAction(); if (!action || !this.shipmentAllowed(action.shipment, action.kind)) return;
    const request = action.kind === 'depart' ? this.api.departShipment(action.shipment.id, this.departureDate) : this.api.arriveShipment(action.shipment.id, this.arrivalDate);
    this.saveAndRefresh(request, action.kind === 'depart' ? 'Salida registrada.' : 'Llegada registrada.', () => this.pendingShipmentAction.set(null));
  }
  protected cancelShipment(item: ImportShipment): void { if (!this.shipmentAllowed(item, 'cancel')) return; const reason = prompt('Motivo de la anulación:')?.trim(); if (reason) this.run(this.api.cancelShipment(item.id, reason), 'Embarque anulado.'); }

  protected openCreateExpense(): void { if (!this.canChange()) return; this.expenseForm = { ...emptyExpense(), currencyCode: this.selected()?.purchaseInvoice?.currencyCode ?? '' }; this.expenseFormOpen.set(true); }
  protected openEditExpense(item: ImportExpense): void {
    if (!this.canChange() || item.status !== 'DRAFT') return;
    this.expenseForm = { id: item.id, category: item.category, description: item.description ?? '', supplierId: item.supplierId ?? '', purchaseInvoiceLineId: item.purchaseInvoiceLineId ?? '', documentType: item.documentType ?? undefined, documentReference: item.documentReference ?? '', expenseDate: inputDate(item.expenseDate), currencyCode: item.currencyCode, amount: item.amount, remarks: item.remarks ?? '' };
    this.expenseFormOpen.set(true);
  }
  protected saveExpense(): void {
    if (!this.canChange()) return;
    const operation = this.selected(); if (!operation) return;
    if (!this.expenseForm.expenseDate || !/^[A-Z]{3}$/.test(this.expenseForm.currencyCode.trim().toUpperCase()) || Number(this.expenseForm.amount) <= 0) { this.error.set('Completa fecha, moneda y un importe válido.'); return; }
    const body = cleanExpense(this.expenseForm);
    const request = this.expenseForm.id ? this.api.updateExpense(this.expenseForm.id, body) : this.api.createExpense(operation.id, body);
    this.saveAndRefresh(request, this.expenseForm.id ? 'Gasto actualizado.' : 'Gasto registrado.', () => this.expenseFormOpen.set(false));
  }
  protected finalizeExpense(item: ImportExpense): void { if (!this.canChange() || item.status !== 'DRAFT') return; if (confirm('¿Finalizar este gasto?')) this.run(this.api.finalizeExpense(item.id), 'Gasto finalizado.'); }
  protected cancelExpense(item: ImportExpense): void { if (!this.canChange() || item.status === 'CANCELLED' || Number(item.allocatedAmount) > 0) return; const reason = prompt('Motivo de la anulación:')?.trim(); if (reason) this.run(this.api.cancelExpense(item.id, reason), 'Gasto anulado.'); }

  protected openAllocation(item: ImportExpense): void {
    if (!this.canChange() || item.status !== 'FINALIZED' || Number(item.unallocatedAmount) <= 0) return;
    this.selectedExpense = item; this.allocationMethod = 'QUANTITY'; this.allocationAmount = item.unallocatedAmount;
    this.allocationLineIds = this.allShipmentLines().map(line => line.id); this.manualAmounts = {}; this.allocationPreview.set(null); this.allocationBatches.set([]); this.allocationOpen.set(true);
    this.api.listAllocations(item.id).pipe(take(1)).subscribe({ next: value => this.allocationBatches.set(value), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected allocationMethodChanged(): void { this.allocationPreview.set(null); }
  protected lineChecked(id: string): boolean { return this.allocationLineIds.includes(id); }
  protected toggleAllocationLine(id: string, checked: boolean): void { this.allocationLineIds = checked ? [...new Set([...this.allocationLineIds, id])] : this.allocationLineIds.filter(item => item !== id); this.allocationPreview.set(null); }
  protected previewAllocation(): void {
    if (!this.canChange()) return;
    if (!this.selectedExpense) return;
    const body = this.allocationBody(); if (!body) return;
    this.saving.set(true); this.api.previewAllocation(this.selectedExpense.id, body).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({ next: value => this.allocationPreview.set(value), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected saveAllocation(): void {
    if (!this.canChange()) return;
    if (!this.selectedExpense) return;
    const body = this.allocationBody(); if (!body || !this.allocationPreview()) return;
    this.saveAndRefresh(this.api.allocateExpense(this.selectedExpense.id, { ...body, idempotencyKey: crypto.randomUUID() }), 'Gasto distribuido.', () => { this.allocationOpen.set(false); this.allocationPreview.set(null); });
  }
  private allocationBody(): AllocateImportExpenseRequest | null {
    if (Number(this.allocationAmount) <= 0) { this.error.set('Ingresa un importe a distribuir.'); return null; }
    if (this.allocationMethod === 'MANUAL') {
      const manualAllocations = Object.entries(this.manualAmounts).filter(([, value]) => Number(value) > 0).map(([importShipmentLineId, amount]) => ({ importShipmentLineId, amount }));
      if (!manualAllocations.length) { this.error.set('Ingresa al menos un importe por línea.'); return null; }
      return { method: 'MANUAL', amountToAllocate: this.allocationAmount, manualAllocations };
    }
    if (!this.allocationLineIds.length) { this.error.set('Selecciona al menos una línea de embarque.'); return null; }
    return { method: this.allocationMethod, amountToAllocate: this.allocationAmount, shipmentLineIds: this.allocationLineIds };
  }

  protected openReceiptLinks(line: ImportShipmentLine): void {
    this.selectedShipmentLine = line; this.receiptSummary.set(null); this.receiptOptions.set([]); this.receiptLineId = ''; this.receiptQuantity = ''; this.receiptOpen.set(true);
    this.api.getReceiptLinks(line.id).pipe(take(1)).subscribe({ next: value => { this.receiptSummary.set(value); this.receiptQuantity = value.remainingQuantity; }, error: error => this.error.set(requestErrorMessage(error)) });
    if (!line.purchaseInvoiceLineId) return;
    const invoice = this.purchases().find(item => item.lines.some(invoiceLine => invoiceLine.id === line.purchaseInvoiceLineId)); if (!invoice) return;
    this.procurementApi.getReceipts(invoice.id).pipe(take(1)).subscribe({
      next: summary => this.receiptOptions.set(summary.receipts.filter(receipt => receipt.status === 'ACTIVE').flatMap(receipt => receipt.lines.filter(receiptLine => receiptLine.purchaseInvoiceLineId === line.purchaseInvoiceLineId).map(receiptLine => receiptOption(receipt.id, receipt.receivedDate, receiptLine)))),
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected createReceiptLink(): void {
    if (!this.canChange() || !this.selected()?.isLegacyUnlinked) return;
    const line = this.selectedShipmentLine; if (!line || !this.receiptLineId || Number(this.receiptQuantity) <= 0) { this.error.set('Selecciona una recepción e ingresa una cantidad.'); return; }
    this.saving.set(true); this.api.createReceiptLink(line.id, { purchaseReceiptLineId: this.receiptLineId, linkedQuantity: this.receiptQuantity, idempotencyKey: crypto.randomUUID() }).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({ next: () => { this.notice.set('Recepción vinculada.'); this.openReceiptLinks(line); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected cancelReceiptLink(id: string): void { if (!this.canChange()) return; const reason = prompt('Motivo para anular el vínculo:')?.trim(); const line = this.selectedShipmentLine; if (!reason || !line) return; this.api.cancelReceiptLink(id, reason).pipe(take(1)).subscribe({ next: () => { this.notice.set('Vínculo anulado.'); this.openReceiptLinks(line); }, error: error => this.error.set(requestErrorMessage(error)) }); }

  protected purchaseLines() { const operation = this.selected(); return this.purchases().filter(invoice => invoice.status === 'CONFIRMED' && (operation?.isLegacyUnlinked || invoice.id === operation?.purchaseInvoiceId)).flatMap(invoice => invoice.lines).filter(line => line.isReceiptEligible !== false); }
  protected allPurchaseLines() { return this.purchases().filter(invoice => invoice.status === 'CONFIRMED').flatMap(invoice => invoice.lines); }
  protected allShipmentLines(): ImportShipmentLine[] { return this.shipments().filter(shipment => shipment.status !== 'CANCELLED').flatMap(shipment => shipment.lines); }
  protected previewAmount(lineId: string): string { return this.allocationPreview()?.lines.find(line => line.importShipmentLineId === lineId)?.amount ?? '0'; }
  private ensureSupplier(id: string): void {
    const merge = (supplier: Supplier) => this.suppliers.update(items => [...items.filter(item => item.id !== supplier.id), supplier]);
    const cached = this.procurementApi.cachedSupplier(id); if (cached) { merge(cached); return; }
    if (this.supplierRequests.has(id)) return;
    this.supplierRequests.add(id);
    this.procurementApi.getSupplier(id).pipe(take(1), finalize(() => this.supplierRequests.delete(id))).subscribe({ next: merge, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected supplierName(id: string | null): string { return id ? this.procurementApi.cachedSupplier(id)?.legalName ?? this.suppliers().find(item => item.id === id)?.legalName ?? 'Consultando proveedor…' : '—'; }
  protected productName(id: string | null | undefined): string { const item = this.products().find(product => product.id === id); return item ? `${item.sku} · ${item.name}` : 'Concepto libre'; }
  protected statusLabel(value: string): string { return STATUS_LABELS[value] ?? value; }
  protected categoryLabel(value: ImportExpenseCategory): string { return this.categories.find(item => item.value === value)?.label ?? value; }
  protected formatDate(value: string): string { return shortDate(value); }
  protected formatMoney(value: string | number, currency = 'PEN'): string { return money(value, currency); }
  protected purchaseLineAmount(lineId: string, value: string): string { return money(value, this.purchases().find(invoice => invoice.lines.some(line => line.id === lineId))?.currencyCode ?? this.expenseForm.currencyCode); }
  protected formatQuantity(value: string): string { return quantity(value); }

  private run<T>(request: import('rxjs').Observable<T>, success: string): void { this.saveAndRefresh(request, success); }
  private saveAndRefresh<T>(request: import('rxjs').Observable<T>, success: string, done?: () => void): void {
    if (!this.canChange()) return;
    this.saving.set(true); this.error.set(null);
    request.pipe(take(1), finalize(() => this.saving.set(false))).subscribe({ next: () => { done?.(); this.notice.set(success); this.load(); this.refreshDetail(); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
}

const STATUS_LABELS: Record<string, string> = { DRAFT: 'Borrador', IN_PROGRESS: 'En curso', COMPLETED: 'Completada', CANCELLED: 'Anulada', PLANNED: 'Planificado', IN_TRANSIT: 'En tránsito', ARRIVED: 'Arribado', FINALIZED: 'Finalizado', PENDING: 'Pendiente', PARTIALLY_RECEIVED: 'Recepción parcial', FULLY_RECEIVED: 'Recibido' };
function today(): string { return new Date().toISOString().slice(0, 10); }
function inputDate(value: string | null | undefined): string { return value?.slice(0, 10) ?? ''; }
function countryValid(value: string): boolean { return /^[A-Za-z]{2}$/.test(value.trim()); }
function optional(value: string | undefined): string | undefined { return value?.trim() || undefined; }
function emptyOperation(): OperationForm { return { purchaseInvoiceId: '', description: '', originCountry: '', destinationCountry: 'PE', externalReference: '', notes: '' }; }
function emptyShipmentLine(): ImportShipmentLineRequest { return { productId: '', descriptionSnapshot: '', plannedQuantity: '1', unitCode: '', unitName: '', weightValue: '', weightUnit: 'KG', volumeValue: '', volumeUnit: 'M3', purchaseInvoiceLineId: '' }; }
function emptyShipment(): ShipmentForm { return { incoterm: null, incotermNamedPlace: null, incotermVersion: null, transportMode: 'SEA', carrierName: '', trackingReference: '', billOfLadingNumber: '', containerReference: '', originLocation: '', destinationLocation: '', estimatedDepartureDate: '', estimatedArrivalDate: '', notes: '', lines: [emptyShipmentLine()] }; }
function lineRequest(line: ImportShipmentLine): ImportShipmentLineRequest { return { productId: line.productId ?? '', descriptionSnapshot: line.descriptionSnapshot, plannedQuantity: line.plannedQuantity, unitCode: line.unitCode ?? '', unitName: line.unitName ?? '', weightValue: line.weightValue ?? '', weightUnit: line.weightUnit ?? 'KG', volumeValue: line.volumeValue ?? '', volumeUnit: line.volumeUnit ?? 'M3', purchaseInvoiceLineId: line.purchaseInvoiceLineId ?? '' }; }
function emptyExpense(): ExpenseForm { return { category: 'FREIGHT', description: '', supplierId: '', purchaseInvoiceLineId: '', documentType: undefined, documentReference: '', expenseDate: today(), currencyCode: '', amount: '0.00', remarks: '' }; }
function cleanExpense(form: ExpenseForm): SaveImportExpenseRequest { return { category: form.category, description: optional(form.description), supplierId: form.supplierId || undefined, purchaseInvoiceLineId: form.purchaseInvoiceLineId || undefined, documentType: form.documentType || undefined, documentReference: optional(form.documentReference), expenseDate: form.expenseDate, currencyCode: form.currencyCode.trim().toUpperCase(), amount: form.amount, remarks: optional(form.remarks) }; }
function receiptOption(receiptId: string, date: string, line: PurchaseReceiptLine): ReceiptOption { return { id: line.id, receiptId, date, quantity: line.quantity }; }
