import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';
import { requestErrorMessage } from '../commercial/commercial.util';
import {
  CreatePaymentMethodRequest,
  PaymentMethodAccountingDestination,
  PaymentMethodDefinition,
} from './payment-method.model';
import { PaymentMethodsService } from './payment-methods.service';

interface PaymentMethodForm {
  code: string;
  name: string;
  active: boolean;
  requiresReference: boolean;
  affectsCashDrawer: boolean;
  accountingDestination: PaymentMethodAccountingDestination;
  sortOrder: number;
}

@Component({
  selector: 'app-payment-methods',
  imports: [FormsModule],
  templateUrl: './payment-methods.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './payment-methods.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodsPage implements OnInit {
  private readonly service = inject(PaymentMethodsService);
  protected readonly methods = signal<PaymentMethodDefinition[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly editing = signal<PaymentMethodDefinition | null | undefined>(undefined);
  protected form: PaymentMethodForm = emptyForm();

  ngOnInit(): void { this.load(); }

  protected openCreate(): void {
    this.form = emptyForm(this.nextSortOrder());
    this.editing.set(null);
    this.error.set(null);
  }

  protected openEdit(method: PaymentMethodDefinition): void {
    this.form = {
      code: method.code,
      name: method.name,
      active: method.active,
      requiresReference: method.requiresReference,
      affectsCashDrawer: method.affectsCashDrawer,
      accountingDestination: method.accountingDestination,
      sortOrder: method.sortOrder,
    };
    this.editing.set(method);
    this.error.set(null);
  }

  protected closeForm(): void { if (!this.saving()) this.editing.set(undefined); }

  protected submit(event: Event): void {
    event.preventDefault();
    const validation = this.validate();
    if (validation) { this.error.set(validation); return; }
    const editing = this.editing();
    this.saving.set(true);
    this.error.set(null);
    const request$ = editing
      ? this.service.update(editing.id, {
          name: this.form.name.trim(),
          active: this.form.active,
          requiresReference: this.form.requiresReference,
          affectsCashDrawer: this.form.affectsCashDrawer,
          accountingDestination: this.form.accountingDestination,
          sortOrder: Number(this.form.sortOrder),
        })
      : this.service.create({
          code: this.form.code.trim().toUpperCase(),
          name: this.form.name.trim(),
          requiresReference: this.form.requiresReference,
          affectsCashDrawer: this.form.affectsCashDrawer,
          accountingDestination: this.form.accountingDestination,
          sortOrder: Number(this.form.sortOrder),
        } satisfies CreatePaymentMethodRequest);

    request$.pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: method => {
        this.editing.set(undefined);
        this.notice.set(editing ? `${method.name} fue actualizado.` : `${method.name} fue creado.`);
        this.load();
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected destinationLabel(value: PaymentMethodAccountingDestination): string {
    return value === 'CASH' ? 'Caja' : 'Bancos';
  }

  private load(): void {
    this.loading.set(true);
    this.service.listAll().pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: methods => this.methods.set(methods),
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  private nextSortOrder(): number {
    const currentMaximum = Math.max(0, ...this.methods().map(method => method.sortOrder));
    return Math.floor(currentMaximum / 10 + 1) * 10;
  }

  private validate(): string | null {
    if (this.editing() === null && !/^[A-Za-z][A-Za-z0-9_]{1,29}$/.test(this.form.code.trim())) return 'El código debe tener entre 2 y 30 caracteres y usar letras, números o guion bajo.';
    if (!this.form.name.trim() || this.form.name.trim().length > 60) return 'Ingresa un nombre de hasta 60 caracteres.';
    if (!Number.isInteger(Number(this.form.sortOrder)) || Number(this.form.sortOrder) < 0) return 'El orden debe ser un número entero igual o mayor que cero.';
    return null;
  }
}

function emptyForm(sortOrder = 10): PaymentMethodForm {
  return {
    code: '',
    name: '',
    active: true,
    requiresReference: false,
    affectsCashDrawer: false,
    accountingDestination: 'BANK',
    sortOrder,
  };
}
