import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, take } from 'rxjs';
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

interface OperationForm extends SaveImportOperationRequest { id?: string }
interface ShipmentForm extends SaveImportShipmentRequest { id?: string }
interface ExpenseForm extends SaveImportExpenseRequest { id?: string }
interface ReceiptOption { id: string; receiptId: string; date: string; quantity: string }

@Component({
  selector: 'app-imports',
  imports: [FormsModule],
  templateUrl: './imports.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './imports.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportsPage implements OnInit {
  private readonly api = inject(ImportsService);
  private readonly catalogApi = inject(CatalogService);
  private readonly procurementApi = inject(ProcurementService);
  protected readonly auth = inject(AuthService);
  protected readonly canWrite = computed(() => this.auth.role() === 'ADMIN');
  protected readonly result = signal<PaginatedResponse<ImportOperation> | null>(null);
  protected readonly selected = signal<ImportOperation | null>(null);
  protected readonly shipments = signal<ImportShipment[]>([]);
  protected readonly expenses = signal<ImportExpense[]>([]);
  protected readonly products = signal<ProductListItem[]>([]);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly purchases = signal<PurchaseInvoice[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly operationFormOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly shipmentFormOpen = signal(false);
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
      purchases: this.procurementApi.listPurchases({ page: 1, limit: 100, status: 'CONFIRMED' }),
    }).pipe(take(1)).subscribe({
      next: ({ suppliers, purchases }) => {
        this.suppliers.set(suppliers.data); this.purchases.set(purchases.data);
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

  protected openCreateOperation(): void { this.operationForm = emptyOperation(); this.operationFormOpen.set(true); }
  protected openEditOperation(): void {
    const item = this.selected(); if (!item) return;
    this.operationForm = { id: item.id, reference: item.reference, description: item.description ?? '', originCountry: item.originCountry, destinationCountry: item.destinationCountry, externalReference: item.externalReference ?? '', notes: item.notes ?? '' };
    this.operationFormOpen.set(true);
  }
  protected saveOperation(): void {
    if (!this.operationForm.reference.trim() || !countryValid(this.operationForm.originCountry) || !countryValid(this.operationForm.destinationCountry)) {
      this.error.set('Completa la referencia y los códigos de país de dos letras.'); return;
    }
    const body = cleanOperation(this.operationForm);
    const request = this.operationForm.id ? this.api.updateOperation(this.operationForm.id, body) : this.api.createOperation(body);
    this.saving.set(true); this.error.set(null);
    request.pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: item => { this.operationFormOpen.set(false); this.notice.set(this.operationForm.id ? 'Importación actualizada.' : 'Importación creada.'); this.load(); this.openDetail(item.id); },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected openDetail(id: string): void {
    this.loading.set(true); this.error.set(null);
    forkJoin({ operation: this.api.getOperation(id), shipments: this.api.listShipments(id), expenses: this.api.listExpenses(id) }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: ({ operation, shipments, expenses }) => { this.selected.set(operation); this.shipments.set(shipments.data); this.expenses.set(expenses.data); this.detailOpen.set(true); },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected refreshDetail(): void { const id = this.selected()?.id; if (id) this.openDetail(id); }
  protected closeDetail(): void { this.detailOpen.set(false); this.selected.set(null); }
  protected completeOperation(): void {
    const item = this.selected(); if (!item || !confirm('¿Completar esta importación?')) return;
    this.run(this.api.completeOperation(item.id), 'Importación completada.');
  }
  protected cancelOperation(): void {
    const item = this.selected(); const reason = prompt('Motivo de la anulación:')?.trim(); if (!item || !reason) return;
    this.run(this.api.cancelOperation(item.id, reason), 'Importación anulada.');
  }

  protected openCreateShipment(): void { this.shipmentForm = emptyShipment(); this.shipmentFormOpen.set(true); }
  protected openEditShipment(item: ImportShipment): void {
    this.shipmentForm = { id: item.id, transportMode: item.transportMode, carrierName: item.carrierName ?? '', trackingReference: item.trackingReference ?? '', billOfLadingNumber: item.billOfLadingNumber ?? '', containerReference: item.containerReference ?? '', originLocation: item.originLocation ?? '', destinationLocation: item.destinationLocation ?? '', estimatedDepartureDate: inputDate(item.estimatedDepartureDate), estimatedArrivalDate: inputDate(item.estimatedArrivalDate), notes: item.notes ?? '', lines: item.lines.map(line => lineRequest(line)) };
    this.shipmentFormOpen.set(true);
  }
  protected addShipmentLine(): void { this.shipmentForm.lines.push(emptyShipmentLine()); }
  protected removeShipmentLine(index: number): void { this.shipmentForm.lines.splice(index, 1); if (!this.shipmentForm.lines.length) this.addShipmentLine(); }
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
    const operation = this.selected(); if (!operation) return;
    const validLines = this.shipmentForm.lines.filter(line => Number(line.plannedQuantity) > 0 && (line.productId || line.descriptionSnapshot?.trim()));
    if (!validLines.length) { this.error.set('Agrega al menos una línea con descripción y cantidad.'); return; }
    const body = cleanShipment({ ...this.shipmentForm, lines: validLines });
    const request = this.shipmentForm.id ? this.api.updateShipment(this.shipmentForm.id, body) : this.api.createShipment(operation.id, body);
    this.saveAndRefresh(request, this.shipmentForm.id ? 'Embarque actualizado.' : 'Embarque creado.', () => this.shipmentFormOpen.set(false));
  }
  protected depart(item: ImportShipment): void { if (confirm('¿Registrar la salida del embarque?')) this.run(this.api.departShipment(item.id, this.departureDate), 'Salida registrada.'); }
  protected arrive(item: ImportShipment): void { if (confirm('¿Registrar la llegada del embarque?')) this.run(this.api.arriveShipment(item.id, this.arrivalDate), 'Llegada registrada.'); }
  protected cancelShipment(item: ImportShipment): void { const reason = prompt('Motivo de la anulación:')?.trim(); if (reason) this.run(this.api.cancelShipment(item.id, reason), 'Embarque anulado.'); }

  protected openCreateExpense(): void { this.expenseForm = emptyExpense(); this.expenseFormOpen.set(true); }
  protected openEditExpense(item: ImportExpense): void {
    this.expenseForm = { id: item.id, category: item.category, description: item.description ?? '', supplierId: item.supplierId ?? '', purchaseInvoiceLineId: item.purchaseInvoiceLineId ?? '', documentType: item.documentType ?? undefined, documentReference: item.documentReference ?? '', expenseDate: inputDate(item.expenseDate), currencyCode: item.currencyCode, amount: item.amount, remarks: item.remarks ?? '' };
    this.expenseFormOpen.set(true);
  }
  protected saveExpense(): void {
    const operation = this.selected(); if (!operation) return;
    if (!this.expenseForm.expenseDate || !/^[A-Z]{3}$/.test(this.expenseForm.currencyCode.trim().toUpperCase()) || Number(this.expenseForm.amount) <= 0) { this.error.set('Completa fecha, moneda y un importe válido.'); return; }
    const body = cleanExpense(this.expenseForm);
    const request = this.expenseForm.id ? this.api.updateExpense(this.expenseForm.id, body) : this.api.createExpense(operation.id, body);
    this.saveAndRefresh(request, this.expenseForm.id ? 'Gasto actualizado.' : 'Gasto registrado.', () => this.expenseFormOpen.set(false));
  }
  protected finalizeExpense(item: ImportExpense): void { if (confirm('¿Finalizar este gasto?')) this.run(this.api.finalizeExpense(item.id), 'Gasto finalizado.'); }
  protected cancelExpense(item: ImportExpense): void { const reason = prompt('Motivo de la anulación:')?.trim(); if (reason) this.run(this.api.cancelExpense(item.id, reason), 'Gasto anulado.'); }

  protected openAllocation(item: ImportExpense): void {
    this.selectedExpense = item; this.allocationMethod = 'QUANTITY'; this.allocationAmount = item.unallocatedAmount;
    this.allocationLineIds = this.allShipmentLines().map(line => line.id); this.manualAmounts = {}; this.allocationPreview.set(null); this.allocationBatches.set([]); this.allocationOpen.set(true);
    this.api.listAllocations(item.id).pipe(take(1)).subscribe({ next: value => this.allocationBatches.set(value), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected allocationMethodChanged(): void { this.allocationPreview.set(null); }
  protected lineChecked(id: string): boolean { return this.allocationLineIds.includes(id); }
  protected toggleAllocationLine(id: string, checked: boolean): void { this.allocationLineIds = checked ? [...new Set([...this.allocationLineIds, id])] : this.allocationLineIds.filter(item => item !== id); this.allocationPreview.set(null); }
  protected previewAllocation(): void {
    if (!this.selectedExpense) return;
    const body = this.allocationBody(); if (!body) return;
    this.saving.set(true); this.api.previewAllocation(this.selectedExpense.id, body).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({ next: value => this.allocationPreview.set(value), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected saveAllocation(): void {
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
    const line = this.selectedShipmentLine; if (!line || !this.receiptLineId || Number(this.receiptQuantity) <= 0) { this.error.set('Selecciona una recepción e ingresa una cantidad.'); return; }
    this.saving.set(true); this.api.createReceiptLink(line.id, { purchaseReceiptLineId: this.receiptLineId, linkedQuantity: this.receiptQuantity, idempotencyKey: crypto.randomUUID() }).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({ next: () => { this.notice.set('Recepción vinculada.'); this.openReceiptLinks(line); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected cancelReceiptLink(id: string): void { const reason = prompt('Motivo para anular el vínculo:')?.trim(); const line = this.selectedShipmentLine; if (!reason || !line) return; this.api.cancelReceiptLink(id, reason).pipe(take(1)).subscribe({ next: () => { this.notice.set('Vínculo anulado.'); this.openReceiptLinks(line); }, error: error => this.error.set(requestErrorMessage(error)) }); }

  protected purchaseLines() { return this.purchases().flatMap(invoice => invoice.lines).filter(line => line.isReceiptEligible !== false); }
  protected allPurchaseLines() { return this.purchases().flatMap(invoice => invoice.lines); }
  protected allShipmentLines(): ImportShipmentLine[] { return this.shipments().flatMap(shipment => shipment.lines); }
  protected previewAmount(lineId: string): string { return this.allocationPreview()?.lines.find(line => line.importShipmentLineId === lineId)?.amount ?? '0'; }
  protected supplierName(id: string | null): string { return this.suppliers().find(item => item.id === id)?.legalName ?? '—'; }
  protected productName(id: string | null | undefined): string { const item = this.products().find(product => product.id === id); return item ? `${item.sku} · ${item.name}` : 'Concepto libre'; }
  protected statusLabel(value: string): string { return STATUS_LABELS[value] ?? value; }
  protected categoryLabel(value: ImportExpenseCategory): string { return this.categories.find(item => item.value === value)?.label ?? value; }
  protected formatDate(value: string): string { return shortDate(value); }
  protected formatMoney(value: string | number, currency = 'PEN'): string { return money(value, currency); }
  protected formatQuantity(value: string): string { return quantity(value); }

  private run<T>(request: import('rxjs').Observable<T>, success: string): void { this.saveAndRefresh(request, success); }
  private saveAndRefresh<T>(request: import('rxjs').Observable<T>, success: string, done?: () => void): void {
    this.saving.set(true); this.error.set(null);
    request.pipe(take(1), finalize(() => this.saving.set(false))).subscribe({ next: () => { done?.(); this.notice.set(success); this.load(); this.refreshDetail(); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
}

const STATUS_LABELS: Record<string, string> = { DRAFT: 'Borrador', IN_PROGRESS: 'En curso', COMPLETED: 'Completada', CANCELLED: 'Anulada', PLANNED: 'Planificado', IN_TRANSIT: 'En tránsito', ARRIVED: 'Arribado', FINALIZED: 'Finalizado', PENDING: 'Pendiente', PARTIALLY_RECEIVED: 'Recepción parcial', FULLY_RECEIVED: 'Recibido' };
function today(): string { return new Date().toISOString().slice(0, 10); }
function inputDate(value: string | null | undefined): string { return value?.slice(0, 10) ?? ''; }
function countryValid(value: string): boolean { return /^[A-Za-z]{2}$/.test(value.trim()); }
function optional(value: string | undefined): string | undefined { return value?.trim() || undefined; }
function emptyOperation(): OperationForm { return { reference: '', description: '', originCountry: '', destinationCountry: 'PE', externalReference: '', notes: '' }; }
function cleanOperation(form: OperationForm): SaveImportOperationRequest { return { reference: form.reference.trim(), description: optional(form.description), originCountry: form.originCountry.trim().toUpperCase(), destinationCountry: form.destinationCountry.trim().toUpperCase(), externalReference: optional(form.externalReference), notes: optional(form.notes) }; }
function emptyShipmentLine(): ImportShipmentLineRequest { return { productId: '', descriptionSnapshot: '', plannedQuantity: '1', unitCode: '', unitName: '', weightValue: '', weightUnit: 'KG', volumeValue: '', volumeUnit: 'M3', purchaseInvoiceLineId: '' }; }
function emptyShipment(): ShipmentForm { return { transportMode: 'SEA', carrierName: '', trackingReference: '', billOfLadingNumber: '', containerReference: '', originLocation: '', destinationLocation: '', estimatedDepartureDate: '', estimatedArrivalDate: '', notes: '', lines: [emptyShipmentLine()] }; }
function lineRequest(line: ImportShipmentLine): ImportShipmentLineRequest { return { productId: line.productId ?? '', descriptionSnapshot: line.descriptionSnapshot, plannedQuantity: line.plannedQuantity, unitCode: line.unitCode ?? '', unitName: line.unitName ?? '', weightValue: line.weightValue ?? '', weightUnit: line.weightUnit ?? 'KG', volumeValue: line.volumeValue ?? '', volumeUnit: line.volumeUnit ?? 'M3', purchaseInvoiceLineId: line.purchaseInvoiceLineId ?? '' }; }
function cleanShipment(form: ShipmentForm): SaveImportShipmentRequest { return { transportMode: form.transportMode, carrierName: optional(form.carrierName), trackingReference: optional(form.trackingReference), billOfLadingNumber: optional(form.billOfLadingNumber), containerReference: optional(form.containerReference), originLocation: optional(form.originLocation), destinationLocation: optional(form.destinationLocation), estimatedDepartureDate: form.estimatedDepartureDate || undefined, estimatedArrivalDate: form.estimatedArrivalDate || undefined, notes: optional(form.notes), lines: form.lines.map(line => ({ productId: line.productId || undefined, descriptionSnapshot: optional(line.descriptionSnapshot), plannedQuantity: line.plannedQuantity, unitCode: optional(line.unitCode), unitName: optional(line.unitName), weightValue: optional(line.weightValue), weightUnit: optional(line.weightUnit), volumeValue: optional(line.volumeValue), volumeUnit: optional(line.volumeUnit), purchaseInvoiceLineId: line.purchaseInvoiceLineId || undefined })) }; }
function emptyExpense(): ExpenseForm { return { category: 'FREIGHT', description: '', supplierId: '', purchaseInvoiceLineId: '', documentType: undefined, documentReference: '', expenseDate: today(), currencyCode: 'USD', amount: '0.00', remarks: '' }; }
function cleanExpense(form: ExpenseForm): SaveImportExpenseRequest { return { category: form.category, description: optional(form.description), supplierId: form.supplierId || undefined, purchaseInvoiceLineId: form.purchaseInvoiceLineId || undefined, documentType: form.documentType || undefined, documentReference: optional(form.documentReference), expenseDate: form.expenseDate, currencyCode: form.currencyCode.trim().toUpperCase(), amount: form.amount, remarks: optional(form.remarks) }; }
function receiptOption(receiptId: string, date: string, line: PurchaseReceiptLine): ReceiptOption { return { id: line.id, receiptId, date, quantity: line.quantity }; }
