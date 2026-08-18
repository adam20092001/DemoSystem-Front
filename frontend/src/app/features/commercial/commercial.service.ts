import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../../core/config/api.config';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import {
  CreateCustomerRequest,
  CreateQuoteRequest,
  CreateSaleRequest,
  Customer,
  ListCustomersQuery,
  ListPaymentsQuery,
  ListQuotesQuery,
  ListReceivablesQuery,
  ListSalesQuery,
  Payment,
  PaymentRegistrationResult,
  PaymentRequest,
  QuoteDetail,
  QuoteListItem,
  ReceivableItem,
  SaleDetail,
  SaleListItem,
  UpdateCustomerRequest,
  UpdateQuoteRequest,
} from './commercial.model';

@Injectable({ providedIn: 'root' })
export class CommercialService {
  private readonly api = inject(ApiClient);
  private readonly config = inject(API_CONFIG);

  listCustomers(query: ListCustomersQuery): Observable<PaginatedResponse<Customer>> {
    return this.api.get<PaginatedResponse<Customer>>('customers', queryParams(query));
  }

  getCustomer(id: string): Observable<Customer> {
    return this.api.get<Customer>(`customers/${id}`);
  }

  createCustomer(request: CreateCustomerRequest): Observable<Customer> {
    return this.api.post<Customer, CreateCustomerRequest>('customers', request);
  }

  updateCustomer(id: string, request: UpdateCustomerRequest): Observable<Customer> {
    return this.api.patch<Customer, UpdateCustomerRequest>(`customers/${id}`, request);
  }

  changeCustomerState(
    id: string,
    action: 'activate' | 'deactivate' | 'block' | 'unblock' | 'convert-to-customer',
  ): Observable<Customer> {
    return this.api.post<Customer, Record<string, never>>(`customers/${id}/${action}`, {});
  }

  listQuotes(query: ListQuotesQuery): Observable<PaginatedResponse<QuoteListItem>> {
    return this.api.get<PaginatedResponse<QuoteListItem>>('quotes', queryParams(query));
  }

  getQuote(id: string): Observable<QuoteDetail> {
    return this.api.get<QuoteDetail>(`quotes/${id}`);
  }

  createQuote(request: CreateQuoteRequest): Observable<QuoteDetail> {
    return this.api.post<QuoteDetail, CreateQuoteRequest>('quotes', request);
  }

  updateQuote(id: string, request: UpdateQuoteRequest): Observable<QuoteDetail> {
    return this.api.patch<QuoteDetail, UpdateQuoteRequest>(`quotes/${id}`, request);
  }

  changeQuoteState(id: string, action: 'accept' | 'reject'): Observable<QuoteDetail> {
    return this.api.post<QuoteDetail, Record<string, never>>(`quotes/${id}/${action}`, {});
  }

  listSales(query: ListSalesQuery): Observable<PaginatedResponse<SaleListItem>> {
    return this.api.get<PaginatedResponse<SaleListItem>>('sales', queryParams(query));
  }

  getSale(id: string): Observable<SaleDetail> {
    return this.api.get<SaleDetail>(`sales/${id}`);
  }

  createSale(request: CreateSaleRequest): Observable<SaleDetail> {
    return this.api.post<SaleDetail, CreateSaleRequest>('sales', request);
  }

  createSaleFromQuote(quoteId: string, payment?: PaymentRequest): Observable<SaleDetail> {
    return this.api.post<SaleDetail, { payment?: PaymentRequest }>(
      `sales/from-quote/${quoteId}`,
      payment ? { payment } : {},
    );
  }

  cancelSale(id: string, reason: string): Observable<SaleDetail> {
    return this.api.post<SaleDetail, { reason: string }>(`sales/${id}/cancel`, { reason });
  }

  changeDeliveryState(id: string, action: 'mark-delivered' | 'mark-observed'): Observable<SaleDetail> {
    return this.api.post<SaleDetail, Record<string, never>>(`sales/${id}/${action}`, {});
  }

  listPayments(query: ListPaymentsQuery): Observable<PaginatedResponse<Payment>> {
    return this.api.get<PaginatedResponse<Payment>>('payments', queryParams(query));
  }

  registerPayment(saleId: string, request: PaymentRequest): Observable<PaymentRegistrationResult> {
    return this.api.post<PaymentRegistrationResult, PaymentRequest>(`sales/${saleId}/payments`, request);
  }

  cancelPayment(saleId: string, paymentId: string, reason: string): Observable<PaymentRegistrationResult> {
    return this.api.post<PaymentRegistrationResult, { reason: string }>(
      `sales/${saleId}/payments/${paymentId}/cancel`,
      { reason },
    );
  }

  listReceivables(query: ListReceivablesQuery): Observable<PaginatedResponse<ReceivableItem>> {
    return this.api.get<PaginatedResponse<ReceivableItem>>('accounts-receivable', queryParams(query));
  }

  openQuotePrint(id: string): void {
    window.open(`${this.config.baseUrl}/quotes/${id}/print`, '_blank', 'noopener');
  }

  openSalePrint(id: string): void {
    window.open(`${this.config.baseUrl}/sales/${id}/print`, '_blank', 'noopener');
  }
}

function queryParams(query: object): QueryParams {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as QueryParams;
}
