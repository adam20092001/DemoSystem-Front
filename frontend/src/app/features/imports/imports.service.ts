import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import type { ReceivingSummary } from './import-receiving.model';
import { AllocateImportExpenseRequest, ConsolidatedReconciliation, CostAttributionPreview, ExpenseReconciliation, ImportExpense, ImportExpenseAllocationBatch, ImportExpenseAllocationPreview, ImportOperation, ImportOperationSummary, ImportReceiptLink, ImportShipment, SaveImportExpenseRequest, SaveImportOperationRequest, SaveImportShipmentRequest, ShipmentLineReceptionSummary, ShipmentReconciliation } from './imports.model';

@Injectable({ providedIn: 'root' })
export class ImportsService {
  private readonly api = inject(ApiClient);
  listOperations(query: object): Observable<PaginatedResponse<ImportOperation>> { return this.api.get('import-operations', params(query)); }
  getOperation(id: string): Observable<ImportOperation> { return this.api.get(`import-operations/${id}`); }
  getReceivingSummary(id: string): Observable<ReceivingSummary> { return this.api.get(`import-operations/${id}/receiving`); }
  createOperation(body: SaveImportOperationRequest): Observable<ImportOperation> { return this.api.post('import-operations', body); }
  updateOperation(id: string, body: Partial<SaveImportOperationRequest>): Observable<ImportOperation> { return this.api.patch(`import-operations/${id}`, body); }
  completeOperation(id: string): Observable<ImportOperation> { return this.api.post(`import-operations/${id}/complete`, {}); }
  cancelOperation(id: string, reason: string): Observable<ImportOperation> { return this.api.post(`import-operations/${id}/cancel`, { reason }); }

  listShipments(operationId: string, query: object = {}): Observable<PaginatedResponse<ImportShipment>> { return this.api.get(`import-operations/${operationId}/shipments`, params({ page: 1, limit: 100, ...query })); }
  getShipment(id: string): Observable<ImportShipment> { return this.api.get(`import-shipments/${id}`); }
  createShipment(operationId: string, body: SaveImportShipmentRequest): Observable<ImportShipment> { return this.api.post(`import-operations/${operationId}/shipments`, body); }
  updateShipment(id: string, body: Partial<SaveImportShipmentRequest>): Observable<ImportShipment> { return this.api.patch(`import-shipments/${id}`, body); }
  departShipment(id: string, actualDepartureDate?: string): Observable<ImportShipment> { return this.api.post(`import-shipments/${id}/depart`, actualDepartureDate ? { actualDepartureDate } : {}); }
  arriveShipment(id: string, actualArrivalDate?: string): Observable<ImportShipment> { return this.api.post(`import-shipments/${id}/arrive`, actualArrivalDate ? { actualArrivalDate } : {}); }
  cancelShipment(id: string, reason: string): Observable<ImportShipment> { return this.api.post(`import-shipments/${id}/cancel`, { reason }); }

  listExpenses(operationId: string, query: object = {}): Observable<PaginatedResponse<ImportExpense>> { return this.api.get(`import-operations/${operationId}/expenses`, params({ page: 1, limit: 100, ...query })); }
  getExpense(id: string): Observable<ImportExpense> { return this.api.get(`import-expenses/${id}`); }
  createExpense(operationId: string, body: SaveImportExpenseRequest): Observable<ImportExpense> { return this.api.post(`import-operations/${operationId}/expenses`, body); }
  updateExpense(id: string, body: Partial<SaveImportExpenseRequest>): Observable<ImportExpense> { return this.api.patch(`import-expenses/${id}`, body); }
  finalizeExpense(id: string): Observable<ImportExpense> { return this.api.post(`import-expenses/${id}/finalize`, {}); }
  cancelExpense(id: string, reason: string): Observable<ImportExpense> { return this.api.post(`import-expenses/${id}/cancel`, { reason }); }
  previewAllocation(id: string, body: AllocateImportExpenseRequest): Observable<ImportExpenseAllocationPreview> { return this.api.post(`import-expenses/${id}/allocate/preview`, body); }
  allocateExpense(id: string, body: AllocateImportExpenseRequest): Observable<ImportExpenseAllocationBatch> { return this.api.post(`import-expenses/${id}/allocate`, body); }
  listAllocations(id: string): Observable<ImportExpenseAllocationBatch[]> { return this.api.get(`import-expenses/${id}/allocations`); }

  getReceiptLinks(shipmentLineId: string): Observable<ShipmentLineReceptionSummary> { return this.api.get(`import-shipment-lines/${shipmentLineId}/receipt-links`); }
  createReceiptLink(shipmentLineId: string, body: { purchaseReceiptLineId: string; linkedQuantity: string; idempotencyKey?: string }): Observable<ImportReceiptLink> { return this.api.post(`import-shipment-lines/${shipmentLineId}/receipt-links`, body); }
  cancelReceiptLink(id: string, reason: string): Observable<ImportReceiptLink> { return this.api.post(`import-receipt-links/${id}/cancel`, { reason }); }
  costAttributionPreview(allocationId: string): Observable<CostAttributionPreview> { return this.api.get(`import-expense-allocations/${allocationId}/cost-attribution-preview`); }

  operationsReport(query: object): Observable<PaginatedResponse<ImportOperationSummary>> { return this.api.get('import-reports/operations', params(query)); }
  shipmentsReport(query: object): Observable<PaginatedResponse<ShipmentReconciliation>> { return this.api.get('import-reports/shipments', params(query)); }
  expensesReport(query: object): Observable<PaginatedResponse<ExpenseReconciliation>> { return this.api.get('import-reports/expenses', params(query)); }
  reconciliationReport(query: object): Observable<PaginatedResponse<ConsolidatedReconciliation>> { return this.api.get('import-reports/reconciliation', params(query)); }
  exportReport(kind: 'operations' | 'shipments' | 'expenses' | 'reconciliation', query: object): Observable<Blob> { return this.api.download(`import-reports/${kind}/export.xlsx`, params(query)); }
}

function params(query: object): QueryParams { return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined)) as QueryParams; }
