import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, finalize, forkJoin, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiRequestError } from '../../core/errors/api-request.error';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import {
  CatalogStatus,
  Category,
  ProductDetail,
  ProductListItem,
  ProductSpecification,
  ProductType,
  SaveCategoryRequest,
  SaveProductRequest,
  SaveSpecificationRequest,
  SaveUnitRequest,
  Unit,
} from './catalog.model';
import { CatalogService } from './catalog.service';

type CatalogTab = 'products' | 'categories' | 'units';
type FormMode = 'create' | 'edit';

interface ProductForm {
  sku: string;
  name: string;
  brand: string;
  productType: ProductType;
  categoryId: string;
  unitId: string;
  salePrice: string;
  commercialDescription: string;
  internalNotes: string;
  isInventoryTracked: boolean;
  stockMinimum: string;
}

interface CategoryForm {
  code: string;
  name: string;
  description: string;
  parentId: string;
  sortOrder: number;
}

interface UnitForm {
  code: string;
  name: string;
  abbreviation: string;
  allowDecimal: boolean;
}

interface SpecificationForm {
  name: string;
  value: string;
  unit: string;
  sortOrder: number;
}

@Component({
  selector: 'app-catalog',
  imports: [FormsModule],
  templateUrl: './catalog.page.html',
  styleUrl: './catalog.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly catalog = inject(CatalogService);

  protected readonly canManage = computed(() => this.auth.role() === 'ADMIN');
  protected readonly activeTab = signal<CatalogTab>('products');
  protected readonly pageSizes = [10, 20, 50];

  protected productSearch = '';
  protected productBrand = '';
  protected productStatus = '';
  protected productType = '';
  protected productCategory = '';
  protected productUnit = '';
  protected productInventory = '';
  protected productLowStock = false;
  protected productPageSize = 20;

  protected categorySearch = '';
  protected categoryStatus = '';
  protected categoryPageSize = 20;

  protected unitSearch = '';
  protected unitStatus = '';
  protected unitDecimals = '';
  protected unitPageSize = 20;

  protected readonly products = signal<PaginatedResponse<ProductListItem> | null>(null);
  protected readonly categories = signal<PaginatedResponse<Category> | null>(null);
  protected readonly units = signal<PaginatedResponse<Unit> | null>(null);
  protected readonly categoryOptions = signal<Category[]>([]);
  protected readonly unitOptions = signal<Unit[]>([]);

  protected readonly loadingProducts = signal(false);
  protected readonly loadingCategories = signal(false);
  protected readonly loadingUnits = signal(false);
  protected readonly loadingDetail = signal(false);
  protected readonly actionLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly productFormMode = signal<FormMode | null>(null);
  protected readonly categoryFormMode = signal<FormMode | null>(null);
  protected readonly unitFormMode = signal<FormMode | null>(null);
  protected readonly editingProductId = signal<string | null>(null);
  protected readonly editingCategoryId = signal<string | null>(null);
  protected readonly editingUnitId = signal<string | null>(null);
  protected readonly selectedProduct = signal<ProductDetail | null>(null);
  protected readonly specificationFormMode = signal<FormMode | null>(null);
  protected readonly editingSpecificationId = signal<string | null>(null);

  protected productForm: ProductForm = emptyProductForm();
  protected categoryForm: CategoryForm = emptyCategoryForm();
  protected unitForm: UnitForm = emptyUnitForm();
  protected specificationForm: SpecificationForm = emptySpecificationForm();

  ngOnInit(): void {
    this.loadLookups();
    this.loadProducts();
    this.loadCategories();
    this.loadUnits();
  }

  protected switchTab(tab: CatalogTab): void {
    this.activeTab.set(tab);
    this.error.set(null);
    this.notice.set(null);
  }

  protected applyProductFilters(event: Event): void {
    event.preventDefault();
    this.loadProducts(1);
  }

  protected clearProductFilters(): void {
    this.productSearch = '';
    this.productBrand = '';
    this.productStatus = '';
    this.productType = '';
    this.productCategory = '';
    this.productUnit = '';
    this.productInventory = '';
    this.productLowStock = false;
    this.loadProducts(1);
  }

  protected loadProducts(page = 1): void {
    this.loadingProducts.set(true);
    this.error.set(null);
    this.catalog.listProducts({
      page,
      limit: this.productPageSize,
      ...(this.productSearch.trim() ? { search: this.productSearch.trim() } : {}),
      ...(this.productBrand.trim() ? { brand: this.productBrand.trim() } : {}),
      ...(this.productStatus ? { status: this.productStatus as CatalogStatus } : {}),
      ...(this.productType ? { productType: this.productType as ProductType } : {}),
      ...(this.productCategory ? { categoryId: this.productCategory } : {}),
      ...(this.productUnit ? { unitId: this.productUnit } : {}),
      ...(this.productLowStock
        ? { isInventoryTracked: true, lowStockOnly: true }
        : this.productInventory
          ? { isInventoryTracked: this.productInventory === 'true' }
          : {}),
    }).pipe(
      take(1),
      finalize(() => this.loadingProducts.set(false)),
    ).subscribe({
      next: result => this.products.set(result),
      error: error => this.error.set(errorMessage(error)),
    });
  }

  protected previousProductPage(): void {
    const page = this.products()?.page ?? 1;
    if (page > 1) this.loadProducts(page - 1);
  }

  protected nextProductPage(): void {
    const result = this.products();
    if (result && result.page < result.totalPages) this.loadProducts(result.page + 1);
  }

  protected openCreateProduct(): void {
    this.error.set(null);
    this.productForm = emptyProductForm();
    this.editingProductId.set(null);
    this.productFormMode.set('create');
  }

  protected openEditProduct(product: ProductListItem | ProductDetail): void {
    this.error.set(null);
    this.loadingDetail.set(true);
    this.catalog.getProduct(product.id).pipe(
      take(1),
      finalize(() => this.loadingDetail.set(false)),
    ).subscribe({
      next: detail => {
        this.selectedProduct.set(null);
        this.closeSpecificationForm();
        this.productForm = {
          sku: detail.sku,
          name: detail.name,
          brand: detail.brand ?? '',
          productType: detail.productType,
          categoryId: detail.category.id,
          unitId: detail.unit.id,
          salePrice: detail.salePrice,
          commercialDescription: detail.commercialDescription ?? '',
          internalNotes: detail.internalNotes ?? '',
          isInventoryTracked: detail.isInventoryTracked,
          stockMinimum: detail.stockMinimum,
        };
        this.editingProductId.set(detail.id);
        this.productFormMode.set('edit');
      },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  protected closeProductForm(): void {
    if (this.actionLoading()) return;
    this.productFormMode.set(null);
    this.editingProductId.set(null);
    this.error.set(null);
  }

  protected productTypeChanged(): void {
    if (this.productForm.productType === 'SERVICE') {
      this.productForm.isInventoryTracked = false;
      this.productForm.stockMinimum = '0';
    }
  }

  protected submitProduct(event: Event): void {
    event.preventDefault();
    const validation = validateProduct(this.productForm);
    if (validation) {
      this.error.set(validation);
      return;
    }

    const mode = this.productFormMode();
    const editingId = this.editingProductId();
    const request: SaveProductRequest = {
      sku: this.productForm.sku.trim(),
      name: this.productForm.name.trim(),
      brand: optionalText(this.productForm.brand, mode === 'edit'),
      productType: this.productForm.productType,
      categoryId: this.productForm.categoryId,
      unitId: this.productForm.unitId,
      salePrice: this.productForm.salePrice.trim(),
      commercialDescription: optionalText(this.productForm.commercialDescription, mode === 'edit'),
      internalNotes: optionalText(this.productForm.internalNotes, mode === 'edit'),
      isInventoryTracked: this.productForm.productType === 'PRODUCT' && this.productForm.isInventoryTracked,
      stockMinimum: this.productForm.productType === 'SERVICE' ? '0' : this.productForm.stockMinimum.trim() || '0',
    };

    const request$ = mode === 'create'
      ? this.catalog.createProduct(request)
      : editingId
        ? this.catalog.updateProduct(editingId, request)
        : null;
    if (!request$) return;

    this.perform(request$, mode === 'create' ? 'Producto creado correctamente.' : 'Producto actualizado correctamente.', () => {
      this.productFormMode.set(null);
      this.editingProductId.set(null);
      this.loadProducts(mode === 'create' ? 1 : (this.products()?.page ?? 1));
    });
  }

  protected openProductDetail(product: ProductListItem): void {
    this.error.set(null);
    this.loadingDetail.set(true);
    this.catalog.getProduct(product.id).pipe(
      take(1),
      finalize(() => this.loadingDetail.set(false)),
    ).subscribe({
      next: detail => this.selectedProduct.set(detail),
      error: error => this.error.set(errorMessage(error)),
    });
  }

  protected closeProductDetail(): void {
    if (this.actionLoading()) return;
    this.selectedProduct.set(null);
    this.closeSpecificationForm();
    this.error.set(null);
  }

  protected toggleProductStatus(product: ProductListItem | ProductDetail): void {
    const activate = product.status === 'INACTIVE';
    if (!confirm(`¿Deseas ${activate ? 'activar' : 'desactivar'} “${product.name}”?`)) return;
    this.perform(
      this.catalog.setProductStatus(product.id, activate),
      `Producto ${activate ? 'activado' : 'desactivado'} correctamente.`,
      updated => {
        if (this.selectedProduct()?.id === updated.id) this.selectedProduct.set(updated);
        this.loadProducts(this.products()?.page ?? 1);
      },
    );
  }

  protected applyCategoryFilters(event: Event): void {
    event.preventDefault();
    this.loadCategories(1);
  }

  protected clearCategoryFilters(): void {
    this.categorySearch = '';
    this.categoryStatus = '';
    this.loadCategories(1);
  }

  protected loadCategories(page = 1): void {
    this.loadingCategories.set(true);
    this.error.set(null);
    this.catalog.listCategories({
      page,
      limit: this.categoryPageSize,
      ...(this.categorySearch.trim() ? { search: this.categorySearch.trim() } : {}),
      ...(this.categoryStatus ? { status: this.categoryStatus as CatalogStatus } : {}),
    }).pipe(
      take(1),
      finalize(() => this.loadingCategories.set(false)),
    ).subscribe({
      next: result => this.categories.set(result),
      error: error => this.error.set(errorMessage(error)),
    });
  }

  protected previousCategoryPage(): void {
    const page = this.categories()?.page ?? 1;
    if (page > 1) this.loadCategories(page - 1);
  }

  protected nextCategoryPage(): void {
    const result = this.categories();
    if (result && result.page < result.totalPages) this.loadCategories(result.page + 1);
  }

  protected openCreateCategory(): void {
    this.error.set(null);
    this.categoryForm = emptyCategoryForm();
    this.editingCategoryId.set(null);
    this.categoryFormMode.set('create');
  }

  protected openEditCategory(category: Category): void {
    this.error.set(null);
    this.categoryForm = {
      code: category.code,
      name: category.name,
      description: category.description ?? '',
      parentId: category.parentId ?? '',
      sortOrder: category.sortOrder,
    };
    this.editingCategoryId.set(category.id);
    this.categoryFormMode.set('edit');
  }

  protected closeCategoryForm(): void {
    if (this.actionLoading()) return;
    this.categoryFormMode.set(null);
    this.editingCategoryId.set(null);
    this.error.set(null);
  }

  protected submitCategory(event: Event): void {
    event.preventDefault();
    if (!this.categoryForm.code.trim() || !this.categoryForm.name.trim()) {
      this.error.set('Completa el código y el nombre de la categoría.');
      return;
    }
    const mode = this.categoryFormMode();
    const editingId = this.editingCategoryId();
    const request: SaveCategoryRequest = {
      code: this.categoryForm.code.trim(),
      name: this.categoryForm.name.trim(),
      description: optionalText(this.categoryForm.description, mode === 'edit'),
      parentId: this.categoryForm.parentId || (mode === 'edit' ? null : undefined),
      sortOrder: Number(this.categoryForm.sortOrder) || 0,
    };
    const request$ = mode === 'create'
      ? this.catalog.createCategory(request)
      : editingId
        ? this.catalog.updateCategory(editingId, request)
        : null;
    if (!request$) return;
    this.perform(request$, mode === 'create' ? 'Categoría creada correctamente.' : 'Categoría actualizada correctamente.', () => {
      this.categoryFormMode.set(null);
      this.editingCategoryId.set(null);
      this.refreshCategories();
    });
  }

  protected toggleCategoryStatus(category: Category): void {
    const activate = category.status === 'INACTIVE';
    if (!confirm(`¿Deseas ${activate ? 'activar' : 'desactivar'} la categoría “${category.name}”?`)) return;
    this.perform(
      this.catalog.setCategoryStatus(category.id, activate),
      `Categoría ${activate ? 'activada' : 'desactivada'} correctamente.`,
      () => this.refreshCategories(),
    );
  }

  protected applyUnitFilters(event: Event): void {
    event.preventDefault();
    this.loadUnits(1);
  }

  protected clearUnitFilters(): void {
    this.unitSearch = '';
    this.unitStatus = '';
    this.unitDecimals = '';
    this.loadUnits(1);
  }

  protected loadUnits(page = 1): void {
    this.loadingUnits.set(true);
    this.error.set(null);
    this.catalog.listUnits({
      page,
      limit: this.unitPageSize,
      ...(this.unitSearch.trim() ? { search: this.unitSearch.trim() } : {}),
      ...(this.unitStatus ? { status: this.unitStatus as CatalogStatus } : {}),
      ...(this.unitDecimals ? { allowDecimal: this.unitDecimals === 'true' } : {}),
    }).pipe(
      take(1),
      finalize(() => this.loadingUnits.set(false)),
    ).subscribe({
      next: result => this.units.set(result),
      error: error => this.error.set(errorMessage(error)),
    });
  }

  protected previousUnitPage(): void {
    const page = this.units()?.page ?? 1;
    if (page > 1) this.loadUnits(page - 1);
  }

  protected nextUnitPage(): void {
    const result = this.units();
    if (result && result.page < result.totalPages) this.loadUnits(result.page + 1);
  }

  protected openCreateUnit(): void {
    this.error.set(null);
    this.unitForm = emptyUnitForm();
    this.editingUnitId.set(null);
    this.unitFormMode.set('create');
  }

  protected openEditUnit(unit: Unit): void {
    this.error.set(null);
    this.unitForm = {
      code: unit.code,
      name: unit.name,
      abbreviation: unit.abbreviation,
      allowDecimal: unit.allowDecimal,
    };
    this.editingUnitId.set(unit.id);
    this.unitFormMode.set('edit');
  }

  protected closeUnitForm(): void {
    if (this.actionLoading()) return;
    this.unitFormMode.set(null);
    this.editingUnitId.set(null);
    this.error.set(null);
  }

  protected submitUnit(event: Event): void {
    event.preventDefault();
    if (!this.unitForm.code.trim() || !this.unitForm.name.trim() || !this.unitForm.abbreviation.trim()) {
      this.error.set('Completa código, nombre y abreviatura.');
      return;
    }
    if (!/^[A-Za-z0-9./-]+$/.test(this.unitForm.abbreviation.trim())) {
      this.error.set('La abreviatura solo admite letras, números, punto, guion y barra.');
      return;
    }
    const mode = this.unitFormMode();
    const editingId = this.editingUnitId();
    const request: SaveUnitRequest = {
      code: this.unitForm.code.trim(),
      name: this.unitForm.name.trim(),
      abbreviation: this.unitForm.abbreviation.trim(),
      allowDecimal: this.unitForm.allowDecimal,
    };
    const request$ = mode === 'create'
      ? this.catalog.createUnit(request)
      : editingId
        ? this.catalog.updateUnit(editingId, request)
        : null;
    if (!request$) return;
    this.perform(request$, mode === 'create' ? 'Unidad creada correctamente.' : 'Unidad actualizada correctamente.', () => {
      this.unitFormMode.set(null);
      this.editingUnitId.set(null);
      this.refreshUnits();
    });
  }

  protected toggleUnitStatus(unit: Unit): void {
    const activate = unit.status === 'INACTIVE';
    if (!confirm(`¿Deseas ${activate ? 'activar' : 'desactivar'} la unidad “${unit.name}”?`)) return;
    this.perform(
      this.catalog.setUnitStatus(unit.id, activate),
      `Unidad ${activate ? 'activada' : 'desactivada'} correctamente.`,
      () => this.refreshUnits(),
    );
  }

  protected openCreateSpecification(): void {
    this.specificationForm = emptySpecificationForm();
    this.editingSpecificationId.set(null);
    this.specificationFormMode.set('create');
    this.error.set(null);
  }

  protected openEditSpecification(specification: ProductSpecification): void {
    this.specificationForm = {
      name: specification.name,
      value: specification.value,
      unit: specification.unit ?? '',
      sortOrder: specification.sortOrder,
    };
    this.editingSpecificationId.set(specification.id);
    this.specificationFormMode.set('edit');
    this.error.set(null);
  }

  protected closeSpecificationForm(): void {
    this.specificationFormMode.set(null);
    this.editingSpecificationId.set(null);
  }

  protected submitSpecification(event: Event): void {
    event.preventDefault();
    const product = this.selectedProduct();
    if (!product) return;
    if (!this.specificationForm.name.trim() || !this.specificationForm.value.trim()) {
      this.error.set('Completa el nombre y el valor de la especificación.');
      return;
    }
    const mode = this.specificationFormMode();
    const specificationId = this.editingSpecificationId();
    const request: SaveSpecificationRequest = {
      name: this.specificationForm.name.trim(),
      value: this.specificationForm.value.trim(),
      unit: optionalText(this.specificationForm.unit, mode === 'edit'),
      sortOrder: Number(this.specificationForm.sortOrder) || 0,
    };
    const request$ = mode === 'create'
      ? this.catalog.createSpecification(product.id, request)
      : specificationId
        ? this.catalog.updateSpecification(product.id, specificationId, request)
        : null;
    if (!request$) return;
    this.perform(request$, mode === 'create' ? 'Especificación agregada.' : 'Especificación actualizada.', () => {
      this.closeSpecificationForm();
      this.refreshProductDetail(product.id);
    });
  }

  protected deleteSpecification(specification: ProductSpecification): void {
    const product = this.selectedProduct();
    if (!product || !confirm(`¿Eliminar la especificación “${specification.name}”?`)) return;
    this.perform(this.catalog.deleteSpecification(product.id, specification.id), 'Especificación eliminada.', () => {
      this.refreshProductDetail(product.id);
    });
  }

  protected uploadImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const product = this.selectedProduct();
    if (!file || !product) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.error.set('Selecciona una imagen JPEG, PNG o WebP.');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.error.set('La imagen no puede superar 5 MB.');
      input.value = '';
      return;
    }
    this.perform(this.catalog.uploadImage(product.id, file), 'Imagen agregada correctamente.', () => {
      input.value = '';
      this.refreshProductDetail(product.id);
      this.loadProducts(this.products()?.page ?? 1);
    });
  }

  protected setPrimaryImage(imageId: string): void {
    const product = this.selectedProduct();
    if (!product) return;
    this.perform(this.catalog.setPrimaryImage(product.id, imageId), 'Imagen principal actualizada.', () => {
      this.refreshProductDetail(product.id);
      this.loadProducts(this.products()?.page ?? 1);
    });
  }

  protected deleteImage(imageId: string): void {
    const product = this.selectedProduct();
    if (!product || !confirm('¿Eliminar esta imagen del producto?')) return;
    this.perform(this.catalog.deleteImage(product.id, imageId), 'Imagen eliminada.', () => {
      this.refreshProductDetail(product.id);
      this.loadProducts(this.products()?.page ?? 1);
    });
  }

  protected statusLabel(status: CatalogStatus): string {
    return status === 'ACTIVE' ? 'Activo' : 'Inactivo';
  }

  protected typeLabel(type: ProductType): string {
    return type === 'PRODUCT' ? 'Producto' : 'Servicio';
  }

  protected statusClass(status: CatalogStatus): string {
    return status === 'ACTIVE' ? 'badge--ok' : 'badge--neutral';
  }

  protected categoryName(id: string | null): string {
    if (!id) return 'Categoría raíz';
    return this.categoryOptions().find(category => category.id === id)?.name ?? 'Categoría no disponible';
  }

  protected money(value: string): string {
    return Number(value).toFixed(2);
  }

  protected fileSize(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  protected firstRecord(result: PaginatedResponse<unknown> | null): number {
    if (!result || result.total === 0) return 0;
    return (result.page - 1) * result.limit + 1;
  }

  protected lastRecord(result: PaginatedResponse<unknown> | null): number {
    return result ? Math.min(result.page * result.limit, result.total) : 0;
  }

  private loadLookups(): void {
    forkJoin({
      categories: this.catalog.listCategories({ page: 1, limit: 100 }),
      units: this.catalog.listUnits({ page: 1, limit: 100 }),
    }).pipe(take(1)).subscribe({
      next: result => {
        this.categoryOptions.set(result.categories.data);
        this.unitOptions.set(result.units.data);
      },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  private refreshCategories(): void {
    this.loadCategories(this.categories()?.page ?? 1);
    this.loadLookups();
  }

  private refreshUnits(): void {
    this.loadUnits(this.units()?.page ?? 1);
    this.loadLookups();
  }

  private refreshProductDetail(productId: string): void {
    this.catalog.getProduct(productId).pipe(take(1)).subscribe({
      next: detail => this.selectedProduct.set(detail),
      error: error => this.error.set(errorMessage(error)),
    });
  }

  private perform<T>(request$: Observable<T>, message: string, after: (value: T) => void): void {
    this.actionLoading.set(true);
    this.error.set(null);
    request$.pipe(
      take(1),
      finalize(() => this.actionLoading.set(false)),
    ).subscribe({
      next: value => {
        this.notice.set(message);
        after(value);
      },
      error: error => this.error.set(errorMessage(error)),
    });
  }
}

function emptyProductForm(): ProductForm {
  return {
    sku: '',
    name: '',
    brand: '',
    productType: 'PRODUCT',
    categoryId: '',
    unitId: '',
    salePrice: '',
    commercialDescription: '',
    internalNotes: '',
    isInventoryTracked: true,
    stockMinimum: '0',
  };
}

function emptyCategoryForm(): CategoryForm {
  return { code: '', name: '', description: '', parentId: '', sortOrder: 0 };
}

function emptyUnitForm(): UnitForm {
  return { code: '', name: '', abbreviation: '', allowDecimal: false };
}

function emptySpecificationForm(): SpecificationForm {
  return { name: '', value: '', unit: '', sortOrder: 0 };
}

function optionalText(value: string, useNull: boolean): string | null | undefined {
  const normalized = value.trim();
  return normalized || (useNull ? null : undefined);
}

function validateProduct(form: ProductForm): string | null {
  if (!form.sku.trim() || !form.name.trim() || !form.categoryId || !form.unitId) {
    return 'Completa SKU, nombre, categoría y unidad de medida.';
  }
  if (!/^\d+(\.\d{1,2})?$/.test(form.salePrice.trim())) {
    return 'El precio debe ser un número no negativo con máximo 2 decimales.';
  }
  if (!/^\d+(\.\d{1,3})?$/.test(form.stockMinimum.trim() || '0')) {
    return 'El stock mínimo debe ser un número no negativo con máximo 3 decimales.';
  }
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiRequestError
    ? error.message
    : 'No se pudo completar la operación. Inténtalo nuevamente.';
}
