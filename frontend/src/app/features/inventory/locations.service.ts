import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';

export interface StockLocation {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  isDefault: boolean;
  warehouseId: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  isDefault: boolean;
}

export interface StockByLocation {
  productId: string;
  stockCurrent: string;
  locations: Array<{ location: { id: string; code: string; name: string; warehouse: { id: string; code: string } }; quantity: string }>;
}

export interface LocationOption extends StockLocation { warehouseCode: string; warehouseName: string }

@Injectable({ providedIn: 'root' })
export class LocationsService {
  private readonly api = inject(ApiClient);

  warehouses(query: QueryParams = { page: 1, limit: 100 }): Observable<PaginatedResponse<Warehouse>> {
    return this.api.get('warehouses', query);
  }
  locations(warehouseId: string, query: QueryParams = { page: 1, limit: 100 }): Observable<PaginatedResponse<StockLocation>> {
    return this.api.get(`warehouses/${warehouseId}/locations`, query);
  }
  createWarehouse(body: { code: string; name: string; description?: string }): Observable<Warehouse> {
    return this.api.post('warehouses', body);
  }
  updateWarehouse(id: string, body: { name: string; description?: string | null }): Observable<Warehouse> {
    return this.api.patch(`warehouses/${id}`, body);
  }
  setWarehouseActive(id: string, active: boolean): Observable<Warehouse> {
    return this.api.post(`warehouses/${id}/${active ? 'activate' : 'deactivate'}`, {});
  }
  createLocation(warehouseId: string, body: { code: string; name: string; description?: string }): Observable<StockLocation> {
    return this.api.post(`warehouses/${warehouseId}/locations`, body);
  }
  updateLocation(warehouseId: string, id: string, body: { name: string; description?: string | null }): Observable<StockLocation> {
    return this.api.patch(`warehouses/${warehouseId}/locations/${id}`, body);
  }
  setLocationActive(warehouseId: string, id: string, active: boolean): Observable<StockLocation> {
    return this.api.post(`warehouses/${warehouseId}/locations/${id}/${active ? 'activate' : 'deactivate'}`, {});
  }
  stockByLocation(productId: string): Observable<StockByLocation> {
    return this.api.get(`inventory/products/${productId}/stock-by-location`);
  }
  activeLocations(): Observable<LocationOption[]> {
    return this.warehouses({ page: 1, limit: 100, status: 'ACTIVE' }).pipe(
      switchMap(result => result.data.length ? forkJoin(result.data.map(warehouse =>
        this.locations(warehouse.id, { page: 1, limit: 100, status: 'ACTIVE' }).pipe(
          map(locations => locations.data.map(location => ({ ...location, warehouseCode: warehouse.code, warehouseName: warehouse.name }))),
        ),
      )) : of([] as LocationOption[][])),
      map(groups => groups.flat()),
    );
  }
}
