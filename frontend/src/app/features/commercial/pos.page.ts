import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, take } from 'rxjs';
import { ProductListItem } from '../catalog/catalog.model';
import { CatalogService } from '../catalog/catalog.service';
import { PosCompanySettings } from '../settings/settings.model';
import { SettingsService } from '../settings/settings.service';
import { PaymentMethodDefinition } from '../payment-methods/payment-method.model';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { Customer, PaymentMethod, PaymentRequest, SaleDetail } from './commercial.model';
import { CommercialService } from './commercial.service';
import {
  money,
  quantity,
  requestErrorMessage,
  requiresPaymentReference,
  validAmount,
  validQuantity,
} from './commercial.util';

interface PosLine { key: number; productId: string; quantity: string; discount: string; }
interface PosPaymentLine { key: number; method: PaymentMethod; amount: string; reference: string; }

@Component({
  selector: 'app-pos',
  imports: [FormsModule],
  templateUrl: './pos.page.html',
  styleUrls: ['./commercial-page.shared.scss', './pos.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosPage implements OnInit {
  protected readonly commercial = inject(CommercialService);
  protected readonly catalog = inject(CatalogService);
  private readonly settingsService = inject(SettingsService);
  private readonly paymentMethodsService = inject(PaymentMethodsService);

  protected readonly customers = signal<Customer[]>([]);
  protected readonly products = signal<ProductListItem[]>([]);
  protected readonly settings = signal<PosCompanySettings | null>(null);
  protected readonly paymentMethods = signal<PaymentMethodDefinition[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly completedSale = signal<SaleDetail | null>(null);
  protected readonly productSearch = signal('');
  protected readonly filteredProducts = computed(() => {
    const query = this.productSearch().trim().toLocaleLowerCase('es');
    const products = query
      ? this.products().filter(product =>
          [product.sku, product.name, product.brand, product.category.name]
            .filter(Boolean)
            .some(value => value!.toLocaleLowerCase('es').includes(query)),
        )
      : this.products();
    return products.slice(0, 18);
  });

  protected customerId = '';
  protected lines: PosLine[] = [];
  protected paymentEnabled = false;
  protected paymentLines: PosPaymentLine[] = [];
  private lineKey = 2;
  private paymentKey = 1;

  ngOnInit(): void { this.loadOptions(); }

  protected addProduct(product: ProductListItem): void {
    if (product.isInventoryTracked && Number(product.stockCurrent) <= 0) {
      this.error.set(`${product.name} no tiene stock disponible.`);
      return;
    }
    const existing = this.lines.find(line => line.productId === product.id);
    if (existing) {
      const next = Number(existing.quantity || 0) + 1;
      if (product.isInventoryTracked && next > Number(product.stockCurrent)) {
        this.error.set(`Solo hay ${product.stockCurrent} ${product.unit.abbreviation} de ${product.name}.`);
        return;
      }
      existing.quantity = String(next);
      this.lines = [...this.lines];
      return;
    }
    this.lines = [...this.lines, { key: this.lineKey++, productId: product.id, quantity: '1', discount: '0' }];
  }

  protected removeLine(key: number): void { this.lines = this.lines.filter(line => line.key !== key); }

  protected changeQuantity(line: PosLine, step: number): void {
    const next = Number(line.quantity || 0) + step;
    if (next <= 0) {
      this.removeLine(line.key);
      return;
    }
    const product = this.productFor(line.productId);
    if (product?.isInventoryTracked && next > Number(product.stockCurrent)) {
      this.error.set(`Solo hay ${product.stockCurrent} ${product.unit.abbreviation} de ${product.name}.`);
      return;
    }
    line.quantity = String(next);
    this.lines = [...this.lines];
  }

  protected itemCount(): number {
    return this.lines.reduce((total, line) => total + Number(line.quantity || 0), 0);
  }

  protected isInCart(productId: string): boolean {
    return this.lines.some(line => line.productId === productId);
  }

  protected productImage(product: ProductListItem): string | null {
    return product.primaryImage ? this.catalog.imageUrl(product.primaryImage.fileUrl) : null;
  }
  protected productFor(id: string): ProductListItem | undefined { return this.products().find(product => product.id === id); }
  protected lineGrossTotal(line: PosLine): number {
    return roundMoney(Number(this.productFor(line.productId)?.salePrice ?? 0) * Number(line.quantity || 0));
  }
  protected lineTotal(line: PosLine): number { return roundMoney(Math.max(0, this.lineGrossTotal(line) - Number(line.discount || 0))); }
  protected subtotal(): number { return roundMoney(this.lines.reduce((sum, line) => sum + this.lineGrossTotal(line), 0)); }
  protected totalDiscount(): number { return roundMoney(this.lines.reduce((sum, line) => sum + Number(line.discount || 0), 0)); }
  protected total(): number { return roundMoney(Math.max(0, this.subtotal() - this.totalDiscount())); }
  protected taxAmount(): number {
    const settings = this.settings();
    const rate = Number(settings?.taxRate ?? 0);
    return settings?.taxEnabled && rate > 0 ? roundMoney(this.total() * rate / (100 + rate)) : 0;
  }
  protected taxableBase(): number { return roundMoney(this.total() - this.taxAmount()); }
  protected formatMoney(value: string | number): string { return money(value, this.settings()?.currencyCode ?? 'PEN'); }
  protected formatQuantity(value: string | number, allowDecimal: boolean): string { return quantity(value, allowDecimal); }
  protected selectedMethodRequiresReference(line: PosPaymentLine): boolean {
    return requiresPaymentReference(this.paymentMethods(), line.method);
  }

  protected togglePayment(enabled: boolean): void {
    this.paymentEnabled = enabled;
    if (enabled && !this.paymentLines.length) this.paymentLines = [this.newPayment(this.total().toFixed(2))];
    if (!enabled) this.paymentLines = [];
  }

  protected addPayment(): void {
    if (this.paymentLines.length < 10) this.paymentLines = [...this.paymentLines, this.newPayment()];
  }

  protected removePayment(key: number): void {
    this.paymentLines = this.paymentLines.filter(line => line.key !== key);
    if (!this.paymentLines.length) this.paymentEnabled = false;
  }

  protected setRemainingPayment(line: PosPaymentLine): void {
    const others = this.paymentLines.filter(item => item.key !== line.key).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    line.amount = Math.max(0, roundMoney(this.total() - others)).toFixed(2);
  }

  protected paymentsTotal(): number {
    return roundMoney(this.paymentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0));
  }

  protected submitSale(event: Event): void {
    event.preventDefault();
    const validation = this.validate();
    if (validation) { this.error.set(validation); return; }
    const payments: PaymentRequest[] = this.paymentEnabled ? this.paymentLines.map(line => ({
      method: line.method,
      amount: line.amount.trim(),
      ...(line.reference.trim() ? { reference: line.reference.trim() } : {}),
    })) : [];
    this.saving.set(true);
    this.error.set(null);
    this.commercial.createSale({
      customerId: this.customerId,
      discountAmount: this.totalDiscount().toFixed(2),
      items: this.lines.map(line => ({ productId: line.productId, quantity: line.quantity.trim() })),
      ...(payments.length ? { payments } : {}),
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
      settings: this.settingsService.getPosConfiguration(),
      paymentMethods: this.paymentMethodsService.listActive(),
    }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: ({ customers, products, settings, paymentMethods }) => {
        this.customers.set(customers.data);
        this.products.set(products.data);
        this.settings.set(settings);
        this.paymentMethods.set(paymentMethods);
        if (!this.customerId) this.customerId = customers.data.find(customer => customer.isGeneric)?.id ?? '';
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  private validate(): string | null {
    if (!this.customerId) return 'Selecciona un cliente.';
    if (!this.lines.length) return 'Agrega al menos un producto o servicio.';
    if (this.lines.some(line => !validAmount(line.discount || '0', true))) return 'Cada descuento debe ser un monto válido con máximo 2 decimales.';
    if (this.lines.some(line => Number(line.discount || 0) > this.lineGrossTotal(line))) return 'El descuento de un producto no puede superar su importe.';
    if (this.subtotal() > 0 && this.totalDiscount() / this.subtotal() * 100 > Number(this.settings()?.maxDiscountPercent ?? 100)) return `El descuento máximo permitido es ${this.settings()?.maxDiscountPercent}%.`;
    if (this.lines.some(line => !line.productId)) return 'Selecciona un producto o servicio en cada línea.';
    if (this.lines.some(line => !validQuantity(line.quantity))) return 'Cada cantidad debe ser mayor que cero y tener máximo 3 decimales.';
    if (new Set(this.lines.map(line => line.productId)).size !== this.lines.length) return 'No repitas productos; ajusta la cantidad en una sola línea.';
    for (const line of this.lines) {
      const product = this.productFor(line.productId);
      if (product && !product.unit.allowDecimal && !Number.isInteger(Number(line.quantity))) return `${product.name} solo admite cantidades enteras.`;
      if (product?.isInventoryTracked && Number(line.quantity) > Number(product.stockCurrent)) return `${product.name} solo tiene ${product.stockCurrent} ${product.unit.abbreviation} disponibles.`;
    }
    if (this.paymentEnabled) {
      if (!this.paymentLines.length || this.paymentLines.length > 10) return 'Registra entre 1 y 10 pagos iniciales.';
      for (const line of this.paymentLines) {
        if (!line.method || !this.paymentMethods().some(method => method.code === line.method)) return 'Selecciona un método disponible en cada pago.';
        if (!validAmount(line.amount)) return 'Cada pago debe ser mayor que cero y tener máximo 2 decimales.';
        if (requiresPaymentReference(this.paymentMethods(), line.method) && !line.reference.trim()) return 'Ingresa la referencia de los pagos que la requieren.';
      }
      if (moneyCents(this.paymentsTotal()) > moneyCents(this.total())) return 'La suma de los pagos iniciales no puede superar el total.';
    }
    const customer = this.customers().find(item => item.id === this.customerId);
    if ((customer?.isGeneric || customer?.status === 'BLOCKED') && this.total() > 0 && moneyCents(this.paymentsTotal()) !== moneyCents(this.total())) return 'Este cliente debe pagar el total de la venta.';
    return null;
  }

  private resetForm(): void {
    this.lines = [];
    this.paymentEnabled = false;
    this.paymentLines = [];
    this.customerId = this.customers().find(customer => customer.isGeneric)?.id ?? '';
  }

  private newPayment(amount = ''): PosPaymentLine {
    return {
      key: this.paymentKey++,
      method: this.paymentMethods().find(method => method.code === 'CASH')?.code ?? this.paymentMethods()[0]?.code ?? '',
      amount,
      reference: '',
    };
  }

  protected stockState(product: ProductListItem): 'service' | 'out' | 'low' | 'available' {
    if (!product.isInventoryTracked) return 'service';
    if (Number(product.stockCurrent) <= 0) return 'out';
    if (Number(product.stockCurrent) <= Number(product.stockMinimum)) return 'low';
    return 'available';
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function moneyCents(value: string | number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100);
}
