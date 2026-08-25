import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, finalize, take } from 'rxjs';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { Category, ProductListItem } from '../catalog/catalog.model';
import { CatalogService } from '../catalog/catalog.service';
import {
  Customer,
  CustomerType,
  PaymentMethod,
  PaymentStatus,
  QuoteStatus,
} from '../commercial/commercial.model';
import { CommercialService } from '../commercial/commercial.service';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  dateTime,
  money,
  pageRange,
  requestErrorMessage,
} from '../commercial/commercial.util';
import {
  PaymentsByMethodRow,
  QuotesByStatusRow,
  ReportKind,
  ReportRow,
  ReportUser,
  SalesByCustomerRow,
  SalesByProductRow,
  SalesBySellerRow,
} from './reports.model';
import { ReportsService } from './reports.service';

@Component({
  selector: 'app-reports',
  imports: [FormsModule],
  templateUrl: './reports.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './reports.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage implements OnInit {
  private readonly reports = inject(ReportsService);
  private readonly catalog = inject(CatalogService);
  private readonly commercial = inject(CommercialService);

  protected readonly activeReport = signal<ReportKind>('sales-by-product');
  protected readonly result = signal<PaginatedResponse<ReportRow> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly categories = signal<Category[]>([]);
  protected readonly products = signal<ProductListItem[]>([]);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly sellers = signal<ReportUser[]>([]);
  protected readonly paymentCreators = signal<ReportUser[]>([]);

  protected readonly reportTabs: Array<{ kind: ReportKind; label: string }> = [
    { kind: 'sales-by-product', label: 'Por producto' },
    { kind: 'sales-by-customer', label: 'Por cliente' },
    { kind: 'sales-by-seller', label: 'Por vendedor' },
    { kind: 'quotes-by-status', label: 'Cotizaciones' },
    { kind: 'payments-by-method', label: 'Pagos' },
  ];
  protected readonly quoteStatuses: QuoteStatus[] = ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'];
  protected readonly paymentMethods = PAYMENT_METHODS;
  protected readonly paymentStatuses: PaymentStatus[] = ['ACTIVE', 'CANCELLED'];
  protected readonly customerTypes: CustomerType[] = ['PERSON', 'COMPANY'];
  protected readonly pageSizes = [10, 20, 50, 100];

  protected from = '';
  protected to = '';
  protected pageSize = 20;
  protected categoryId = '';
  protected productId = '';
  protected customerId = '';
  protected customerType = '';
  protected sellerId = '';
  protected quoteStatus = '';
  protected paymentMethod = '';
  protected paymentStatus = '';
  protected paymentCreatorId = '';

  ngOnInit(): void {
    this.loadLookups();
    this.loadReport();
  }

  protected switchReport(kind: ReportKind): void {
    if (kind === this.activeReport()) return;
    this.activeReport.set(kind);
    this.categoryId = '';
    this.productId = '';
    this.customerId = '';
    this.customerType = '';
    this.sellerId = '';
    this.quoteStatus = '';
    this.paymentMethod = '';
    this.paymentStatus = '';
    this.paymentCreatorId = '';
    this.result.set(null);
    this.error.set(null);
    this.loadReport(1);
  }

  protected applyFilters(event: Event): void {
    event.preventDefault();
    if (this.from && this.to && this.from > this.to) {
      this.error.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    this.loadReport(1);
  }

  protected clearFilters(): void {
    this.from = '';
    this.to = '';
    this.categoryId = '';
    this.productId = '';
    this.customerId = '';
    this.customerType = '';
    this.sellerId = '';
    this.quoteStatus = '';
    this.paymentMethod = '';
    this.paymentStatus = '';
    this.paymentCreatorId = '';
    this.loadReport(1);
  }

  protected previousPage(): void {
    const page = this.result()?.page ?? 1;
    if (page > 1) this.loadReport(page - 1);
  }

  protected nextPage(): void {
    const result = this.result();
    if (result && result.page < result.totalPages) this.loadReport(result.page + 1);
  }

  protected productRows(): SalesByProductRow[] {
    return (this.result()?.data ?? []) as SalesByProductRow[];
  }

  protected customerRows(): SalesByCustomerRow[] {
    return (this.result()?.data ?? []) as SalesByCustomerRow[];
  }

  protected sellerRows(): SalesBySellerRow[] {
    return (this.result()?.data ?? []) as SalesBySellerRow[];
  }

  protected quoteRows(): QuotesByStatusRow[] {
    return (this.result()?.data ?? []) as QuotesByStatusRow[];
  }

  protected paymentRows(): PaymentsByMethodRow[] {
    return (this.result()?.data ?? []) as PaymentsByMethodRow[];
  }

  protected title(): string {
    return {
      'sales-by-product': 'Ventas por producto',
      'sales-by-customer': 'Ventas por cliente',
      'sales-by-seller': 'Ventas por vendedor',
      'quotes-by-status': 'Cotizaciones por estado',
      'payments-by-method': 'Pagos por método',
    }[this.activeReport()];
  }

  protected description(): string {
    return {
      'sales-by-product': 'Productos vendidos, cantidades y montos acumulados.',
      'sales-by-customer': 'Ventas, pagos y saldos agrupados por cliente.',
      'sales-by-seller': 'Resultados comerciales y cobranza por vendedor.',
      'quotes-by-status': 'Historial de cotizaciones y ventas resultantes.',
      'payments-by-method': 'Historial de pagos con método, referencia y responsable.',
    }[this.activeReport()];
  }

  protected visibleAmount(): number {
    switch (this.activeReport()) {
      case 'sales-by-product': return this.productRows().reduce((sum, row) => sum + Number(row.totalSold), 0);
      case 'sales-by-customer': return this.customerRows().reduce((sum, row) => sum + Number(row.totalSold), 0);
      case 'sales-by-seller': return this.sellerRows().reduce((sum, row) => sum + Number(row.totalSold), 0);
      case 'quotes-by-status': return this.quoteRows().reduce((sum, row) => sum + Number(row.total), 0);
      case 'payments-by-method': return this.paymentRows().reduce((sum, row) => sum + Number(row.amount), 0);
    }
  }

  protected formatMoney(value: string | number): string { return money(value); }
  protected formatDate(value: string): string { return dateTime(value); }
  protected range(): string { return pageRange(this.result()); }
  protected paymentMethodLabel(value: PaymentMethod): string { return PAYMENT_METHOD_LABELS[value]; }
  protected paymentStatusLabel(value: PaymentStatus): string { return value === 'ACTIVE' ? 'Activo' : 'Anulado'; }
  protected customerTypeLabel(value: CustomerType | null): string { return value === 'PERSON' ? 'Persona' : value === 'COMPANY' ? 'Empresa' : 'Sin tipo'; }
  protected quoteStatusLabel(value: QuoteStatus): string {
    return { PENDING: 'Pendiente', ACCEPTED: 'Aceptada', REJECTED: 'Rechazada', EXPIRED: 'Vencida', CONVERTED: 'Convertida' }[value];
  }

  protected loadReport(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    const common = {
      page,
      limit: this.pageSize,
      ...(this.from ? { from: this.from } : {}),
      ...(this.to ? { to: this.to } : {}),
    };
    let request$: Observable<PaginatedResponse<ReportRow>>;
    switch (this.activeReport()) {
      case 'sales-by-product':
        request$ = this.reports.salesByProduct({
          ...common,
          ...(this.categoryId ? { categoryId: this.categoryId } : {}),
          ...(this.productId ? { productId: this.productId } : {}),
        });
        break;
      case 'sales-by-customer':
        request$ = this.reports.salesByCustomer({
          ...common,
          ...(this.customerId ? { customerId: this.customerId } : {}),
          ...(this.customerType ? { customerType: this.customerType as CustomerType } : {}),
        });
        break;
      case 'sales-by-seller':
        request$ = this.reports.salesBySeller({ ...common, ...(this.sellerId ? { sellerId: this.sellerId } : {}) });
        break;
      case 'quotes-by-status':
        request$ = this.reports.quotesByStatus({
          ...common,
          ...(this.quoteStatus ? { status: this.quoteStatus as QuoteStatus } : {}),
          ...(this.customerId ? { customerId: this.customerId } : {}),
        });
        break;
      case 'payments-by-method':
        request$ = this.reports.paymentsByMethod({
          ...common,
          ...(this.paymentMethod ? { method: this.paymentMethod as PaymentMethod } : {}),
          ...(this.paymentStatus ? { status: this.paymentStatus as PaymentStatus } : {}),
          ...(this.paymentCreatorId ? { createdByUserId: this.paymentCreatorId } : {}),
        });
        break;
    }
    request$.pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: (result) => {
        this.result.set(result);
        if (this.activeReport() === 'sales-by-seller') this.mergeUsers(this.sellers, this.sellerRows().map((row) => row.seller));
        if (this.activeReport() === 'payments-by-method') this.mergeUsers(this.paymentCreators, this.paymentRows().map((row) => row.createdBy));
      },
      error: (error) => this.error.set(requestErrorMessage(error)),
    });
  }

  private loadLookups(): void {
    this.catalog.listCategories({ page: 1, limit: 100 }).pipe(take(1)).subscribe({ next: (result) => this.categories.set(result.data), error: () => undefined });
    this.catalog.listProducts({ page: 1, limit: 100 }).pipe(take(1)).subscribe({ next: (result) => this.products.set(result.data), error: () => undefined });
    this.commercial.listCustomers({ page: 1, limit: 100 }).pipe(take(1)).subscribe({ next: (result) => this.customers.set(result.data), error: () => undefined });
  }

  private mergeUsers(target: { set(value: ReportUser[]): void; (): ReportUser[] }, users: ReportUser[]): void {
    const byId = new Map(target().map((user) => [user.id, user]));
    users.forEach((user) => byId.set(user.id, user));
    target.set([...byId.values()].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)));
  }
}
