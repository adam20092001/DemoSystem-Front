import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import {
  AccountPayable, AgingReport, PayablesSummary, PurchaseInvoice, PurchaseReceipt,
  PurchaseReceiptsSummary, ReconciliationReport, SavePurchaseInvoiceRequest,
  SaveSupplierRequest, Supplier, SupplierPayment, ReceivableInvoice, ReceivableInvoiceDetail,
} from './procurement.model';

@Injectable({ providedIn: 'root' })
export class ProcurementService {
  private readonly api = inject(ApiClient);
  private readonly supplierDirectory = signal<ReadonlyMap<string, Supplier>>(new Map());
  cachedSupplier(id: string): Supplier | undefined { return this.supplierDirectory().get(id); }
  private rememberSuppliers(suppliers: Supplier[]): void { this.supplierDirectory.update(current => { const next = new Map(current); suppliers.forEach(supplier => next.set(supplier.id, supplier)); return next; }); }

  listSuppliers(query: object): Observable<PaginatedResponse<Supplier>> { return this.api.get<PaginatedResponse<Supplier>>('suppliers', params(query)).pipe(tap(result => this.rememberSuppliers(result.data))); }
  getSupplier(id: string): Observable<Supplier> { return this.api.get<Supplier>(`suppliers/${id}`).pipe(tap(supplier => this.rememberSuppliers([supplier]))); }
  createSupplier(body: SaveSupplierRequest): Observable<Supplier> { return this.api.post<Supplier>('suppliers', body).pipe(tap(supplier => this.rememberSuppliers([supplier]))); }
  updateSupplier(id: string, body: Partial<SaveSupplierRequest>): Observable<Supplier> { return this.api.patch<Supplier>(`suppliers/${id}`, body).pipe(tap(supplier => this.rememberSuppliers([supplier]))); }
  setSupplierActive(id: string, active: boolean): Observable<Supplier> { return this.api.post<Supplier>(`suppliers/${id}/${active ? 'activate' : 'deactivate'}`, {}).pipe(tap(supplier => this.rememberSuppliers([supplier]))); }

  listPurchases(query: object): Observable<PaginatedResponse<PurchaseInvoice>> { return this.api.get('purchase-invoices', params(query)); }
  getPurchase(id: string): Observable<PurchaseInvoice> { return this.api.get(`purchase-invoices/${id}`); }
  createPurchase(body: SavePurchaseInvoiceRequest): Observable<PurchaseInvoice> { return this.api.post('purchase-invoices', body); }
  updatePurchase(id: string, body: Partial<SavePurchaseInvoiceRequest>): Observable<PurchaseInvoice> { return this.api.patch(`purchase-invoices/${id}`, body); }
  confirmPurchase(id: string): Observable<PurchaseInvoice> { return this.api.post(`purchase-invoices/${id}/confirm`, {}); }
  cancelPurchase(id: string, reason: string): Observable<PurchaseInvoice> { return this.api.post(`purchase-invoices/${id}/cancel`, { reason }); }

  getReceipts(invoiceId: string): Observable<PurchaseReceiptsSummary> { return this.api.get(`purchase-invoices/${invoiceId}/receipts`); }
  listReceivableInvoices(query: object): Observable<PaginatedResponse<ReceivableInvoice>> { return this.api.get('purchase-receiving/invoices', params(query)); }
  getReceivableInvoice(id: string): Observable<ReceivableInvoiceDetail> { return this.api.get(`purchase-receiving/invoices/${id}`); }
  createReceipt(invoiceId: string, body: { receivedDate?: string; notes?: string; idempotencyKey?: string; lines: Array<{ purchaseInvoiceLineId: string; quantity: string; locationId?: string }> }): Observable<PurchaseReceipt> { return this.api.post(`purchase-invoices/${invoiceId}/receipts`, body); }
  cancelReceipt(id: string, reason: string): Observable<PurchaseReceipt> { return this.api.post(`purchase-receipts/${id}/cancel`, { reason }); }

  listPayables(query: object): Observable<PaginatedResponse<AccountPayable>> { return this.api.get('accounts-payable', params(query)); }
  getPayablesSummary(query: object): Observable<PayablesSummary> { return this.api.get('accounts-payable/summary', params(query)); }
  getAging(query: object): Observable<AgingReport> { return this.api.get('accounts-payable/aging', params(query)); }
  getReconciliation(query: object): Observable<ReconciliationReport> { return this.api.get('accounts-payable/reconciliation', params(query)); }
  exportPayables(kind: 'list' | 'summary' | 'aging' | 'reconciliation', query: object): Observable<Blob> {
    const path = kind === 'list' ? 'accounts-payable/export.xlsx' : `accounts-payable/${kind}/export.xlsx`;
    return this.api.download(path, params(query));
  }

  listSupplierPayments(query: object): Observable<PaginatedResponse<SupplierPayment>> { return this.api.get('supplier-payments', params(query)); }
  createSupplierPayment(body: { supplierId: string; paymentDate?: string; currencyCode?: string; exchangeRate?: string; exchangeRateDate?: string; amount: string; method: string; reference?: string; idempotencyKey?: string; allocations: Array<{ purchaseInvoiceId: string; amount: string }> }): Observable<SupplierPayment> { return this.api.post('supplier-payments', body); }
  cancelSupplierPayment(id: string, reason: string): Observable<SupplierPayment> { return this.api.post(`supplier-payments/${id}/cancel`, { reason }); }
}

function params(query: object): QueryParams {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined)) as QueryParams;
}
