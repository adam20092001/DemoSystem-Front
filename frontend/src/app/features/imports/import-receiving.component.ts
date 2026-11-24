import { DateInputComponent } from '../../shared/date-input.component';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { AuthService } from '../../core/auth/auth.service';
import { ApiRequestError } from '../../core/errors/api-request.error';
import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { LocationOption, LocationsService } from '../inventory/locations.service';
import { quantity, requestErrorMessage, shortDate } from '../commercial/commercial.util';
import { ImportOperation, ImportShipment } from './imports.model';
import { PendingReceiving, ReceivingFormRow, ReceivingResult, ReceivingShipment, ReceivingSummary } from './import-receiving.model';
import { buildLinkRequest, buildReceiveRequest, completionBlock, shipmentReceptionState } from './import-receiving.util';

@Component({
  selector: 'app-import-receiving', imports: [DateInputComponent, FormsModule],
  templateUrl: './import-receiving.component.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './import-receiving.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportReceivingComponent {
  protected readonly formatDate = shortDate;
  readonly operation = input.required<ImportOperation>();
  readonly shipmentDetails = input<ImportShipment[]>([]);
  readonly blocked = input(false);
  readonly changed = output<void>();
  readonly completeRequested = output<void>();
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private readonly locationsApi = inject(LocationsService);
  protected readonly canWrite = computed(() => ['ADMIN', 'PURCHASING'].includes(this.auth.role()));
  protected readonly summary = signal<ReceivingSummary | null>(null);
  protected readonly locations = signal<LocationOption[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = visibleErrorSignal();
  protected readonly notice = signal('');
  protected readonly modal = signal<ReceivingShipment | null>(null);
  protected readonly mode = signal<'receive' | 'link-receipts'>('receive');
  protected readonly pending = signal<PendingReceiving | null>(null);
  protected rows: ReceivingFormRow[] = [];
  protected receivedDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  protected notes = '';
  protected completeOperation = false;
  private loadVersion = 0;
  constructor() {
    effect(() => { const operation = this.operation(); untracked(() => { this.restorePending(); this.load(operation.id); }); });
    if (this.canWrite()) this.locationsApi.activeLocations().pipe(take(1)).subscribe({ next: items => this.locations.set(items), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected load(id = this.operation().id): void {
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.api.get<ReceivingSummary>(`import-operations/${id}/receiving`).pipe(take(1), finalize(() => { if (version === this.loadVersion) this.loading.set(false); })).subscribe({ next: value => { if (version === this.loadVersion) this.summary.set(value); }, error: error => { if (version !== this.loadVersion) return; this.summary.set(null); this.error.set(requestErrorMessage(error)); } });
  }
  protected qty(value: string | null): string { return quantity(value ?? '0'); }
  protected statusLabel(value: string): string { return ({ PLANNED: 'Planificado', IN_TRANSIT: 'En tránsito', ARRIVED: 'Arribado', CANCELLED: 'Anulado' } as Record<string, string>)[value] ?? value; }
  protected hasCandidates(shipment: ReceivingShipment): boolean { return shipment.lines.some(line => line.candidateReceiptLines.length > 0 && Number(line.pendingQuantity) > 0); }
  protected hasReceivable(shipment: ReceivingShipment): boolean { return shipment.lines.some(line => line.isReceivable && Number(line.maxReceivableNow) > 0); }
  protected receptionState = shipmentReceptionState;
  protected earliestReceptionDate(): string { return this.shipmentDetails().find(item => item.id === this.modal()?.importShipmentId)?.actualArrivalDate?.slice(0, 10) ?? ''; }
  protected completionReason(): string | null { return completionBlock(this.summary(), this.modal()?.importShipmentId ?? '', this.rows); }
  protected canRequestCompletion(): boolean { return !this.loading() && this.completionReason() === null; }
  protected blockReason(summary: ReceivingSummary): string {
    if (summary.isLegacyUnlinked) return 'Esta importación histórica no tiene una compra principal vinculada.';
    if (summary.status === 'COMPLETED') return 'Importación completada.';
    if (summary.status === 'CANCELLED') return 'Importación anulada.';
    if (summary.purchaseInvoiceStatus !== 'CONFIRMED') return 'Confirma la compra antes de recibir mercadería.';
    return 'La importación debe estar en curso y el embarque debe haber arribado.';
  }
  protected open(shipment: ReceivingShipment, mode: 'receive' | 'link-receipts'): void {
    if (!this.canWrite() || this.blocked() || this.loading() || this.saving() || !shipment.canReceive || this.pending()) return;
    this.mode.set(mode); this.notes = ''; this.completeOperation = false;
    this.rows = shipment.lines.filter(line => line.isReceivable && Number(line.pendingQuantity) > 0).map(source => ({ source, quantity: mode === 'receive' ? source.maxReceivableNow : '0', locationId: '', receiptLineId: '', submittedIndex: -1 }));
    this.error.set(null); this.modal.set(shipment);
  }
  protected close(): void { if (!this.saving()) this.modal.set(null); }
  protected locationChanged(row: ReceivingFormRow): void {
    // Una misma línea de factura no se recibe en dos ubicaciones en una solicitud.
    this.rows.filter(item => item.source.purchaseInvoiceLineId === row.source.purchaseInvoiceLineId).forEach(item => item.locationId = row.locationId);
  }
  protected submit(): void {
    if (this.saving() || this.blocked() || this.loading() || !this.modal() || !this.canWrite()) return;
    if (this.pending()) { this.retry(); return; }
    try {
      const latest = this.summary()?.shipments.find(shipment => shipment.importShipmentId === this.modal()!.importShipmentId);
      if (!this.summary()?.canReceive || !latest?.canReceive) throw new Error('La importación ya no admite esta recepción. Actualiza los pendientes.');
      this.rows.forEach(row => { const line = latest.lines.find(item => item.importShipmentLineId === row.source.importShipmentLineId); if (!line) throw new Error('El contenido del embarque cambió. Cierra esta ventana y vuelve a abrirla.'); row.source = line; });
      if (this.completeOperation && !this.canRequestCompletion()) throw new Error(this.completionReason() || 'No se puede completar todavía.');
      const body = this.mode() === 'receive' ? buildReceiveRequest(this.rows, this.completeOperation, this.receivedDate, this.notes) : buildLinkRequest(this.rows, this.completeOperation);
      const attempt: PendingReceiving = { shipmentId: this.modal()!.importShipmentId, mode: this.mode(), key: crypto.randomUUID(), body };
      this.pending.set(attempt); this.persist(attempt); this.send(attempt);
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Revisa las cantidades.'); }
  }
  protected retry(): void { const attempt = this.pending(); if (attempt && !this.saving() && this.canWrite()) this.send(attempt); }
  private send(attempt: PendingReceiving): void {
    this.saving.set(true); this.error.set(null);
    const path = `import-operations/${this.operation().id}/shipments/${attempt.shipmentId}/${attempt.mode}`;
    this.api.post<ReceivingResult>(path, attempt.body, { 'Idempotency-Key': attempt.key }).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: result => {
        this.pending.set(null); this.persist(null); this.modal.set(null);
        this.notice.set(result.operationCompleted ? 'Mercadería recibida o vinculada e importación completada.' : result.mode === 'RECEIVE' ? 'Recepción registrada e inventario actualizado.' : 'Recepción vinculada sin duplicar inventario.');
        this.load(); this.changed.emit();
      },
      error: error => {
        if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) { this.pending.set(null); this.persist(null); }
        this.error.set(requestErrorMessage(error)); this.load();
      },
    });
  }
  private storageKey(): string { return `import-receiving:${this.auth.userId()}:${this.operation().id}`; }
  private persist(attempt: PendingReceiving | null): void { try { if (attempt) sessionStorage.setItem(this.storageKey(), JSON.stringify(attempt)); else sessionStorage.removeItem(this.storageKey()); } catch { /* El reintento sigue disponible en memoria si no hay almacenamiento. */ } }
  private restorePending(): void {
    this.pending.set(null);
    try {
      const value = JSON.parse(sessionStorage.getItem(this.storageKey()) ?? 'null');
      if (value && typeof value.shipmentId === 'string' && /^[0-9a-f-]{36}$/i.test(value.shipmentId) && typeof value.key === 'string' && ['receive', 'link-receipts'].includes(value.mode) && value.body && typeof value.body === 'object') this.pending.set(value);
    } catch { /* Una entrada inválida no impide consultar la importación. */ }
  }
}
