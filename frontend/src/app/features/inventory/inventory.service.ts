import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import {
  InventoryMovement,
  InventoryOperation,
  ListLowStockQuery,
  ListMovementsQuery,
  LowStockItem,
  ProductStock,
  RegisterInventoryMovementRequest,
} from './inventory.model';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly api = inject(ApiClient);

  listMovements(query: ListMovementsQuery): Observable<PaginatedResponse<InventoryMovement>> {
    return this.api.get<PaginatedResponse<InventoryMovement>>(
      'inventory/movements',
      toQueryParams(query),
    );
  }

  listProductMovements(
    productId: string,
    query: ListMovementsQuery,
  ): Observable<PaginatedResponse<InventoryMovement>> {
    return this.api.get<PaginatedResponse<InventoryMovement>>(
      `inventory/products/${productId}/movements`,
      toQueryParams(query),
    );
  }

  getProductStock(productId: string): Observable<ProductStock> {
    return this.api.get<ProductStock>(`inventory/products/${productId}/stock`);
  }

  listLowStock(query: ListLowStockQuery): Observable<PaginatedResponse<LowStockItem>> {
    return this.api.get<PaginatedResponse<LowStockItem>>(
      'inventory/low-stock',
      toQueryParams(query),
    );
  }

  registerMovement(
    operation: InventoryOperation,
    request: RegisterInventoryMovementRequest,
  ): Observable<InventoryMovement> {
    const path: Record<InventoryOperation, string> = {
      INITIAL_BALANCE: 'inventory/initial-balances',
      ENTRY: 'inventory/entries',
      EXIT: 'inventory/exits',
      ADJUSTMENT_IN: 'inventory/adjustments/in',
      ADJUSTMENT_OUT: 'inventory/adjustments/out',
    };
    return this.api.post<InventoryMovement, RegisterInventoryMovementRequest>(
      path[operation],
      request,
    );
  }
}

function toQueryParams(query: object): QueryParams {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as QueryParams;
}
