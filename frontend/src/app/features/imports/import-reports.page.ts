import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, Observable, take } from 'rxjs';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { money, quantity, requestErrorMessage, shortDate } from '../commercial/commercial.util';
import { ConsolidatedReconciliation, ExpenseReconciliation, ImportOperation, ImportOperationSummary, ShipmentReconciliation } from './imports.model';
import { ImportsService } from './imports.service';

type ReportTab = 'operations' | 'shipments' | 'expenses' | 'reconciliation';

@Component({
  selector: 'app-import-reports',
  imports: [FormsModule],
  templateUrl: './import-reports.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './import-reports.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportReportsPage implements OnInit {
  private readonly api = inject(ImportsService);
  protected readonly tab = signal<ReportTab>('operations');
  protected readonly operations = signal<ImportOperation[]>([]);
  protected readonly operationResult = signal<PaginatedResponse<ImportOperationSummary> | null>(null);
  protected readonly shipmentResult = signal<PaginatedResponse<ShipmentReconciliation> | null>(null);
  protected readonly expenseResult = signal<PaginatedResponse<ExpenseReconciliation> | null>(null);
  protected readonly reconciliationResult = signal<PaginatedResponse<ConsolidatedReconciliation> | null>(null);
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected importOperationId = '';
  protected status = '';
  protected reconciliationStatus = '';
  protected currencyCode = '';
  protected onlyWithDiscrepancies = false;

  ngOnInit(): void {
    this.api.listOperations({ page: 1, limit: 100 }).pipe(take(1)).subscribe({ next: value => this.operations.set(value.data), error: error => this.error.set(requestErrorMessage(error)) });
    this.load();
  }
  protected selectTab(tab: ReportTab): void { this.tab.set(tab); this.status = ''; this.reconciliationStatus = ''; this.currencyCode = ''; this.onlyWithDiscrepancies = false; this.load(1); }
  protected apply(event: Event): void { event.preventDefault(); this.load(1); }
  protected clear(): void { this.importOperationId = ''; this.status = ''; this.reconciliationStatus = ''; this.currencyCode = ''; this.onlyWithDiscrepancies = false; this.load(1); }
  protected load(page = 1): void {
    this.loading.set(true); this.error.set(null); const query = this.query(page);
    const request = (this.tab() === 'operations' ? this.api.operationsReport(query)
      : this.tab() === 'shipments' ? this.api.shipmentsReport(query)
      : this.tab() === 'expenses' ? this.api.expensesReport(query)
      : this.api.reconciliationReport(query)) as Observable<PaginatedResponse<unknown>>;
    request.pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: value => {
        if (this.tab() === 'operations') this.operationResult.set(value as PaginatedResponse<ImportOperationSummary>);
        else if (this.tab() === 'shipments') this.shipmentResult.set(value as PaginatedResponse<ShipmentReconciliation>);
        else if (this.tab() === 'expenses') this.expenseResult.set(value as PaginatedResponse<ExpenseReconciliation>);
        else this.reconciliationResult.set(value as PaginatedResponse<ConsolidatedReconciliation>);
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected exportExcel(): void {
    this.exporting.set(true); this.error.set(null);
    this.api.exportReport(this.tab(), this.query()).pipe(take(1), finalize(() => this.exporting.set(false))).subscribe({
      next: blob => download(blob, `importaciones-${this.tab()}.xlsx`), error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected previous(): void { const page = this.current()?.page ?? 1; if (page > 1) this.load(page - 1); }
  protected next(): void { const result = this.current(); if (result && result.page < result.totalPages) this.load(result.page + 1); }
  protected current(): PaginatedResponse<unknown> | null { return this.tab() === 'operations' ? this.operationResult() : this.tab() === 'shipments' ? this.shipmentResult() : this.tab() === 'expenses' ? this.expenseResult() : this.reconciliationResult(); }
  protected operationReference(id: string): string { return this.operations().find(item => item.id === id)?.reference ?? id.slice(0, 8); }
  protected statusLabel(value: string): string { return LABELS[value] ?? value.replaceAll('_', ' ').toLowerCase(); }
  protected formatDate(value: string): string { return shortDate(value); }
  protected formatMoney(value: string, currency: string): string { return money(value, currency); }
  protected formatQuantity(value: string): string { return quantity(value); }
  protected totalExpense(item: ImportOperationSummary): string { return item.expensesByCurrency.map(expense => `${expense.currencyCode} ${Number(expense.totalAmount).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`).join(' · ') || '—'; }
  private query(page?: number): object {
    const common = { importOperationId: this.importOperationId, ...(page ? { page, limit: 20 } : {}) };
    if (this.tab() === 'operations') return { ...common, status: this.status };
    if (this.tab() === 'shipments') return { ...common, shipmentStatus: this.status, onlyWithDiscrepancies: this.onlyWithDiscrepancies || undefined };
    if (this.tab() === 'expenses') return { ...common, status: this.status, currencyCode: this.currencyCode.trim().toUpperCase() };
    return { ...common, status: this.status, reconciliationStatus: this.reconciliationStatus };
  }
}

const LABELS: Record<string, string> = { DRAFT: 'Borrador', IN_PROGRESS: 'En curso', COMPLETED: 'Completada', CANCELLED: 'Anulada', PLANNED: 'Planificado', IN_TRANSIT: 'En tránsito', ARRIVED: 'Arribado', FINALIZED: 'Finalizado', CONSISTENT: 'Consistente', PARTIAL_PENDING_OPERATIONAL_LINK: 'Vínculos pendientes', PENDING_ACCOUNTING_POLICY: 'Política contable pendiente', PENDING_FX: 'Tipo de cambio pendiente', DATA_INCONSISTENCY: 'Datos por revisar' };
function download(blob: Blob, name: string): void { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
