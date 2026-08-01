import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../../core/config/api.config';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import {
  Category,
  ListCategoriesQuery,
  ListProductsQuery,
  ListUnitsQuery,
  ProductDetail,
  ProductImage,
  ProductListItem,
  ProductSpecification,
  SaveCategoryRequest,
  SaveProductRequest,
  SaveSpecificationRequest,
  SaveUnitRequest,
  Unit,
} from './catalog.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(ApiClient);
  private readonly config = inject(API_CONFIG);

  listCategories(query: ListCategoriesQuery): Observable<PaginatedResponse<Category>> {
    return this.api.get<PaginatedResponse<Category>>('categories', toQueryParams(query));
  }

  createCategory(request: SaveCategoryRequest): Observable<Category> {
    return this.api.post<Category, SaveCategoryRequest>('categories', request);
  }

  updateCategory(id: string, request: SaveCategoryRequest): Observable<Category> {
    return this.api.patch<Category, SaveCategoryRequest>(`categories/${id}`, request);
  }

  setCategoryStatus(id: string, active: boolean): Observable<Category> {
    return this.api.post<Category, Record<string, never>>(
      `categories/${id}/${active ? 'activate' : 'deactivate'}`,
      {},
    );
  }

  listUnits(query: ListUnitsQuery): Observable<PaginatedResponse<Unit>> {
    return this.api.get<PaginatedResponse<Unit>>('units', toQueryParams(query));
  }

  createUnit(request: SaveUnitRequest): Observable<Unit> {
    return this.api.post<Unit, SaveUnitRequest>('units', request);
  }

  updateUnit(id: string, request: SaveUnitRequest): Observable<Unit> {
    return this.api.patch<Unit, SaveUnitRequest>(`units/${id}`, request);
  }

  setUnitStatus(id: string, active: boolean): Observable<Unit> {
    return this.api.post<Unit, Record<string, never>>(
      `units/${id}/${active ? 'activate' : 'deactivate'}`,
      {},
    );
  }

  listProducts(query: ListProductsQuery): Observable<PaginatedResponse<ProductListItem>> {
    return this.api.get<PaginatedResponse<ProductListItem>>('products', toQueryParams(query));
  }

  getProduct(id: string): Observable<ProductDetail> {
    return this.api.get<ProductDetail>(`products/${id}`);
  }

  createProduct(request: SaveProductRequest): Observable<ProductDetail> {
    return this.api.post<ProductDetail, SaveProductRequest>('products', request);
  }

  updateProduct(id: string, request: SaveProductRequest): Observable<ProductDetail> {
    return this.api.patch<ProductDetail, SaveProductRequest>(`products/${id}`, request);
  }

  setProductStatus(id: string, active: boolean): Observable<ProductDetail> {
    return this.api.post<ProductDetail, Record<string, never>>(
      `products/${id}/${active ? 'activate' : 'deactivate'}`,
      {},
    );
  }

  createSpecification(productId: string, request: SaveSpecificationRequest): Observable<ProductSpecification> {
    return this.api.post<ProductSpecification, SaveSpecificationRequest>(
      `products/${productId}/specifications`,
      request,
    );
  }

  updateSpecification(
    productId: string,
    specificationId: string,
    request: SaveSpecificationRequest,
  ): Observable<ProductSpecification> {
    return this.api.patch<ProductSpecification, SaveSpecificationRequest>(
      `products/${productId}/specifications/${specificationId}`,
      request,
    );
  }

  deleteSpecification(productId: string, specificationId: string): Observable<void> {
    return this.api.delete<void>(`products/${productId}/specifications/${specificationId}`);
  }

  uploadImage(productId: string, file: File, sortOrder = 0): Observable<ProductImage> {
    const body = new FormData();
    body.append('file', file);
    body.append('sortOrder', String(sortOrder));
    return this.api.post<ProductImage, FormData>(`products/${productId}/images`, body);
  }

  setPrimaryImage(productId: string, imageId: string): Observable<ProductImage> {
    return this.api.post<ProductImage, Record<string, never>>(
      `products/${productId}/images/${imageId}/primary`,
      {},
    );
  }

  deleteImage(productId: string, imageId: string): Observable<void> {
    return this.api.delete<void>(`products/${productId}/images/${imageId}`);
  }

  imageUrl(fileUrl: string): string {
    return new URL(fileUrl, this.config.baseUrl).toString();
  }
}

function toQueryParams(query: object): QueryParams {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as QueryParams;
}
