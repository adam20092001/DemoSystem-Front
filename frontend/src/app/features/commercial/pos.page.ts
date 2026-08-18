import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, take } from 'rxjs';
import { ProductListItem } from '../catalog/catalog.model';
import { CatalogService } from '../catalog/catalog.service';
import { Customer, PaymentMethod, PaymentRequest, SaleDetail } from './commercial.model';
import { CommercialService } from './commercial.service';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  money,
  requestErrorMessage,
  requiresPaymentReference,
  validAmount,
  validQuantity,
} from './commercial.util';

interface PosLine { key: number; productId: string; quantity: string; }

@Component({
  selector: 'app-pos',
  imports: [FormsModule],
  templateUrl: './pos.page.html',
  styleUrl: './commercial-page.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosPage implements OnInit {
  protected readonly commercial = inject(CommercialService);
  private readonly catalog = inject(CatalogService);

  protected readonly customers = signal<Customer[]>([]);
  protected readonly products = signal<ProductListItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly completedSale = signal<SaleDetail | null>(null);
  protected readonly paymentMethods = PAYMENT_METHODS;

  protected customerId = '';
  protected discountAmount = '0';
  protected lines: PosLine[] = [{ key: 1, productId: '', quantity: '1' }];
  protected paymentEnabled = false;
  protected paymentMethod: PaymentMethod = 'CASH';
  protected paymentAmount = '';
  protected paymentReference = '';
  private lineKey = 2;

  ngOnInit(): void { this.loadOptions(); }

  protected addLine(): void { this.lines.push({ key: this.lineKey++, productId: '', quantity: '1' }); }
  protected removeLine(key: number): void { if (this.lines.length > 1) this.lines = this.lines.filter(line => line.key !== key); }
  protected productFor(id: string): ProductListItem | undefined { return this.products().find(product => product.id === id); }
  protected lineTotal(line: PosLine): number { return Number(this.productFor(line.productId)?.salePrice ?? 0) * Number(line.quantity || 0); }
  protected subtotal(): number { return this.lines.reduce((sum, line) => sum + this.lineTotal(line), 0); }
  protected total(): number { return Math.max(0, this.subtotal() - Number(this.discountAmount || 0)); }
  protected formatMoney(value: string | number): string { return money(value); }
  protected methodLabel(method: PaymentMethod): string { return PAYMENT_METHOD_LABELS[method]; }

  protected submitSale(event: Event): void {
    event.preventDefault();
    const validation = this.validate();
    if (validation) { this.error.set(validation); return; }
    let payment: PaymentRequest | undefined;
    if (this.paymentEnabled) {
      payment = {
        method: this.paymentMethod,
        amount: this.paymentAmount.trim(),
        ...(this.paymentReference.trim() ? { reference: this.paymentReference.trim() } : {}),
      };
    }
    this.saving.set(true);
    this.error.set(null);
    this.commercial.createSale({
      customerId: this.customerId,
      discountAmount: this.discountAmount.trim() || '0',
      items: this.lines.map(line => ({ productId: line.productId, quantity: line.quantity.trim() })),
      ...(payment ? { payment } : {}),
    }).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: sale => { this.completedSale.set(sale); this.resetForm(); this.loadOptions(); },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected closeResult(): void { this.completedSale.set(null); }

  private loadOptions(): void {
    this.loading.set(true);
    forkJoin({
      customers: this.commercial.listCustomers({ page: 1, limit: 100, status: 'ACTIVE' }),
      products: this.catalog.listProducts({ page: 1, limit: 100, status: 'ACTIVE' }),
    }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: ({ customers, products }) => {
        this.customers.set(customers.data);
        this.products.set(products.data);
        if (!this.customerId) this.customerId = customers.data.find(customer => customer.isGeneric)?.id ?? '';
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  private validate(): string | null {
    if (!this.customerId) return 'Selecciona un cliente.';
    if (!validAmount(this.discountAmount || '0', true)) return 'El descuento debe ser un monto válido con máximo 2 decimales.';
    if (Number(this.discountAmount || 0) > this.subtotal()) return 'El descuento no puede superar el subtotal.';
    if (this.lines.some(line => !line.productId)) return 'Selecciona un producto o servicio en cada línea.';
    if (this.lines.some(line => !validQuantity(line.quantity))) return 'Cada cantidad debe ser mayor que cero y tener máximo 3 decimales.';
    if (new Set(this.lines.map(line => line.productId)).size !== this.lines.length) return 'No repitas productos; ajusta la cantidad en una sola línea.';
    for (const line of this.lines) {
      const product = this.productFor(line.productId);
      if (product && !product.unit.allowDecimal && !Number.isInteger(Number(line.quantity))) return `${product.name} solo admite cantidades enteras.`;
    }
    if (this.paymentEnabled) {
      if (!validAmount(this.paymentAmount)) return 'El pago debe ser mayor que cero y tener máximo 2 decimales.';
      if (Number(this.paymentAmount) > this.total()) return 'El pago inicial no puede superar el total.';
      if (requiresPaymentReference(this.paymentMethod) && !this.paymentReference.trim()) return 'Ingresa la referencia del pago.';
    }
    const customer = this.customers().find(item => item.id === this.customerId);
    if (customer?.isGeneric && this.total() > 0 && (!this.paymentEnabled || Number(this.paymentAmount) !== this.total())) return 'Las ventas a Público general deben pagarse por completo.';
    return null;
  }

  private resetForm(): void {
    this.discountAmount = '0';
    this.lines = [{ key: this.lineKey++, productId: '', quantity: '1' }];
    this.paymentEnabled = false;
    this.paymentMethod = 'CASH';
    this.paymentAmount = '';
    this.paymentReference = '';
    this.customerId = this.customers().find(customer => customer.isGeneric)?.id ?? '';
  }
}
