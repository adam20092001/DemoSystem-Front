import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, take } from 'rxjs';
import { ProductListItem } from '../catalog/catalog.model';
import { CatalogService } from '../catalog/catalog.service';
import { PosCompanySettings } from '../settings/settings.model';
import { SettingsService } from '../settings/settings.service';
import { CashSessionsService } from '../cash-sessions/cash-sessions.service';
import { PaymentMethodDefinition } from '../payment-methods/payment-method.model';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { Customer, PaymentMethod, PaymentRequest, SaleDetail } from './commercial.model';
import { CommercialService } from './commercial.service';
import {
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
  styleUrls: ['./commercial-page.shared.scss', './pos.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosPage implements OnInit {
  protected readonly commercial = inject(CommercialService);
  protected readonly catalog = inject(CatalogService);
  private readonly settingsService = inject(SettingsService);
  protected readonly cashSessions = inject(CashSessionsService);
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
  protected discountAmount = '0';
  protected lines: PosLine[] = [];
  protected paymentEnabled = false;
  protected paymentMethod: PaymentMethod = '';
  protected paymentAmount = '';
  protected paymentReference = '';
  private lineKey = 2;

  ngOnInit(): void { this.loadOptions(); }

  protected addProduct(product: ProductListItem): void {
    const existing = this.lines.find(line => line.productId === product.id);
    if (existing) {
      existing.quantity = String(Number(existing.quantity || 0) + 1);
      this.lines = [...this.lines];
      return;
    }
    this.lines = [...this.lines, { key: this.lineKey++, productId: product.id, quantity: '1' }];
  }

  protected removeLine(key: number): void { this.lines = this.lines.filter(line => line.key !== key); }

  protected changeQuantity(line: PosLine, step: number): void {
    const next = Number(line.quantity || 0) + step;
    if (next <= 0) {
      this.removeLine(line.key);
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
  protected lineTotal(line: PosLine): number {
    return roundMoney(Number(this.productFor(line.productId)?.salePrice ?? 0) * Number(line.quantity || 0));
  }
  protected subtotal(): number { return roundMoney(this.lines.reduce((sum, line) => sum + this.lineTotal(line), 0)); }
  protected taxableBase(): number { return roundMoney(Math.max(0, this.subtotal() - Number(this.discountAmount || 0))); }
  protected taxAmount(): number {
    const settings = this.settings();
    return settings?.taxEnabled ? roundMoney(this.taxableBase() * Number(settings.taxRate) / 100) : 0;
  }
  protected total(): number { return roundMoney(this.taxableBase() + this.taxAmount()); }
  protected formatMoney(value: string | number): string { return money(value, this.settings()?.currencyCode ?? 'PEN'); }
  protected selectedMethodRequiresReference(): boolean {
    return requiresPaymentReference(this.paymentMethods(), this.paymentMethod);
  }

  protected togglePayment(enabled: boolean): void {
    this.paymentEnabled = enabled;
    if (enabled && !this.paymentAmount) this.paymentAmount = this.total().toFixed(2);
  }

  protected setFullPayment(): void {
    this.paymentAmount = this.total().toFixed(2);
  }

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
      settings: this.settingsService.getPosConfiguration(),
      paymentMethods: this.paymentMethodsService.listActive(),
      cashSession: this.cashSessions.refreshCurrent(),
    }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: ({ customers, products, settings, paymentMethods }) => {
        this.customers.set(customers.data);
        this.products.set(products.data);
        this.settings.set(settings);
        this.paymentMethods.set(paymentMethods);
        if (!paymentMethods.some(method => method.code === this.paymentMethod)) {
          this.paymentMethod = paymentMethods.find(method => method.code === 'CASH')?.code ?? paymentMethods[0]?.code ?? '';
        }
        if (!this.customerId) this.customerId = customers.data.find(customer => customer.isGeneric)?.id ?? '';
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  private validate(): string | null {
    if (!this.customerId) return 'Selecciona un cliente.';
    if (!this.lines.length) return 'Agrega al menos un producto o servicio.';
    if (!validAmount(this.discountAmount || '0', true)) return 'El descuento debe ser un monto válido con máximo 2 decimales.';
    if (Number(this.discountAmount || 0) > this.subtotal()) return 'El descuento no puede superar el subtotal.';
    if (this.subtotal() > 0 && Number(this.discountAmount || 0) / this.subtotal() * 100 > Number(this.settings()?.maxDiscountPercent ?? 100)) return `El descuento máximo permitido es ${this.settings()?.maxDiscountPercent}%.`;
    if (this.lines.some(line => !line.productId)) return 'Selecciona un producto o servicio en cada línea.';
    if (this.lines.some(line => !validQuantity(line.quantity))) return 'Cada cantidad debe ser mayor que cero y tener máximo 3 decimales.';
    if (new Set(this.lines.map(line => line.productId)).size !== this.lines.length) return 'No repitas productos; ajusta la cantidad en una sola línea.';
    for (const line of this.lines) {
      const product = this.productFor(line.productId);
      if (product && !product.unit.allowDecimal && !Number.isInteger(Number(line.quantity))) return `${product.name} solo admite cantidades enteras.`;
    }
    if (this.paymentEnabled) {
      if (!this.cashSessions.hasOpenSession()) return 'Abre tu caja antes de registrar un cobro.';
      if (!this.paymentMethod || !this.paymentMethods().some(method => method.code === this.paymentMethod)) return 'Selecciona un método de pago disponible.';
      if (!validAmount(this.paymentAmount)) return 'El pago debe ser mayor que cero y tener máximo 2 decimales.';
      if (moneyCents(this.paymentAmount) > moneyCents(this.total())) return 'El pago inicial no puede superar el total.';
      if (requiresPaymentReference(this.paymentMethods(), this.paymentMethod) && !this.paymentReference.trim()) return 'Ingresa la referencia del pago.';
    }
    const customer = this.customers().find(item => item.id === this.customerId);
    if (customer?.isGeneric && this.total() > 0 && (!this.paymentEnabled || moneyCents(this.paymentAmount) !== moneyCents(this.total()))) return 'Las ventas a Público general deben pagarse por completo.';
    return null;
  }

  private resetForm(): void {
    this.discountAmount = '0';
    this.lines = [];
    this.paymentEnabled = false;
    this.paymentMethod = this.paymentMethods().find(method => method.code === 'CASH')?.code ?? this.paymentMethods()[0]?.code ?? '';
    this.paymentAmount = '';
    this.paymentReference = '';
    this.customerId = this.customers().find(customer => customer.isGeneric)?.id ?? '';
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function moneyCents(value: string | number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100);
}
