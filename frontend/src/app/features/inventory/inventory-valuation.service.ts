import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { PendingValuationItem, ValuedInventoryItem } from './inventory-valuation.model';

@Injectable({ providedIn: 'root' })
export class InventoryValuationService {
  private readonly api = inject(ApiClient);

  list(query: { page: number; limit: number; productId?: string }): Observable<PaginatedResponse<ValuedInventoryItem>> {
    return this.api.get('inventory/valuation', params(query));
  }

  pending(query: { page: number; limit: number; productId?: string }): Observable<PaginatedResponse<PendingValuationItem>> {
    return this.api.get('inventory/valuation/pending', params(query));
  }
}

function params(query: object): QueryParams {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== undefined && value !== null)) as QueryParams;
}
