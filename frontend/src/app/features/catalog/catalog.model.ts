export type CatalogStatus = 'ACTIVE' | 'INACTIVE';
export type ProductType = 'PRODUCT' | 'SERVICE';

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  status: CatalogStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  allowDecimal: boolean;
  status: CatalogStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategorySummary {
  id: string;
  code: string;
  name: string;
}

export interface ProductUnitSummary {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  allowDecimal: boolean;
}

export interface ProductImage {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
  fileUrl: string;
}

export interface ProductSpecification {
  id: string;
  name: string;
  value: string;
  unit: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListItem {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  productType: ProductType;
  category: ProductCategorySummary;
  unit: ProductUnitSummary;
  salePrice: string;
  isInventoryTracked: boolean;
  stockCurrent: string;
  stockMinimum: string;
  status: CatalogStatus;
  createdAt: string;
  updatedAt: string;
  internalNotes?: string | null;
  primaryImage: ProductImage | null;
}

export interface ProductDetail extends ProductListItem {
  commercialDescription: string | null;
  specifications: ProductSpecification[];
  images: ProductImage[];
}

export interface ListCatalogQuery {
  page: number;
  limit: number;
  search?: string;
  status?: CatalogStatus;
}

export interface ListCategoriesQuery extends ListCatalogQuery {
  parentId?: string;
}

export interface ListUnitsQuery extends ListCatalogQuery {
  allowDecimal?: boolean;
}

export interface ListProductsQuery extends ListCatalogQuery {
  categoryId?: string;
  unitId?: string;
  productType?: ProductType;
  isInventoryTracked?: boolean;
}

export interface SaveCategoryRequest {
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}

export interface SaveUnitRequest {
  code: string;
  name: string;
  abbreviation: string;
  allowDecimal: boolean;
}

export interface SaveProductRequest {
  sku: string;
  name: string;
  brand?: string | null;
  productType: ProductType;
  categoryId: string;
  unitId: string;
  salePrice: string;
  commercialDescription?: string | null;
  internalNotes?: string | null;
  isInventoryTracked: boolean;
  stockMinimum?: string;
}

export interface SaveSpecificationRequest {
  name: string;
  value: string;
  unit?: string | null;
  sortOrder?: number;
}
