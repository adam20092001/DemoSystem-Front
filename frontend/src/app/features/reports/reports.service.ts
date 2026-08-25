import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import {
  PaymentsByMethodQuery,
  PaymentsByMethodRow,
  QuotesByStatusQuery,
  QuotesByStatusRow,
  SalesByCustomerQuery,
  SalesByCustomerRow,
  SalesByProductQuery,
  SalesByProductRow,
  SalesBySellerQuery,
  SalesBySellerRow,
} from './reports.model';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = inject(ApiClient);

  salesByProduct(query: SalesByProductQuery): Observable<PaginatedResponse<SalesByProductRow>> {
    return this.get('sales-by-product', query);
  }

  salesByCustomer(query: SalesByCustomerQuery): Observable<PaginatedResponse<SalesByCustomerRow>> {
    return this.get('sales-by-customer', query);
  }

  salesBySeller(query: SalesBySellerQuery): Observable<PaginatedResponse<SalesBySellerRow>> {
    return this.get('sales-by-seller', query);
  }

  quotesByStatus(query: QuotesByStatusQuery): Observable<PaginatedResponse<QuotesByStatusRow>> {
    return this.get('quotes-by-status', query);
  }

  paymentsByMethod(query: PaymentsByMethodQuery): Observable<PaginatedResponse<PaymentsByMethodRow>> {
    return this.get('payments-by-method', query);
  }

  private get<T>(path: string, query: object): Observable<PaginatedResponse<T>> {
    return this.api.get<PaginatedResponse<T>>(`reports/${path}`, queryParams(query));
  }
}

function queryParams(query: object): QueryParams {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as QueryParams;
}
