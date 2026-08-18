import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import {
  CreateCustomerRequest,
  Customer,
  CustomerDocumentType,
  CustomerStage,
  CustomerStatus,
  CustomerType,
  UpdateCustomerRequest,
} from './commercial.model';
import { CommercialService } from './commercial.service';
import { pageRange, requestErrorMessage } from './commercial.util';

type FormMode = 'create' | 'edit';
type CustomerAction = 'activate' | 'deactivate' | 'block' | 'unblock' | 'convert-to-customer';

interface CustomerForm {
  customerType: CustomerType;
  customerStage: CustomerStage;
  name: string;
  documentType: CustomerDocumentType | '';
  documentNumber: string;
  tradeName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  internalNotes: string;
}

@Component({
  selector: 'app-customers',
  imports: [FormsModule],
  templateUrl: './customers.page.html',
  styleUrl: './commercial-page.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly commercial = inject(CommercialService);

  protected readonly canWrite = computed(() => ['ADMIN', 'SELLER'].includes(this.auth.role()));
  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  protected readonly result = signal<PaginatedResponse<Customer> | null>(null);
  protected readonly loading = signal(false);
  protected readonly actionLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly formMode = signal<FormMode | null>(null);
  protected readonly editing = signal<Customer | null>(null);
  protected readonly pendingAction = signal<{ action: CustomerAction; customer: Customer } | null>(null);

  protected readonly pageSizes = [10, 20, 50];
  protected readonly customerTypes: CustomerType[] = ['PERSON', 'COMPANY'];
  protected readonly customerStages: CustomerStage[] = ['PROSPECT', 'CUSTOMER'];
  protected readonly customerStatuses: CustomerStatus[] = ['ACTIVE', 'INACTIVE', 'BLOCKED'];
  protected readonly documentTypes: CustomerDocumentType[] = ['DNI', 'RUC', 'CE', 'PASSPORT', 'OTHER'];

  protected search = '';
  protected status = '';
  protected customerType = '';
  protected customerStage = '';
  protected pageSize = 20;
  protected form: CustomerForm = emptyCustomerForm();

  ngOnInit(): void {
    this.loadCustomers();
  }

  protected applyFilters(event: Event): void {
    event.preventDefault();
    this.loadCustomers(1);
  }

  protected clearFilters(): void {
    this.search = '';
    this.status = '';
    this.customerType = '';
    this.customerStage = '';
    this.loadCustomers(1);
  }

  protected previousPage(): void {
    const page = this.result()?.page ?? 1;
    if (page > 1) this.loadCustomers(page - 1);
  }

  protected nextPage(): void {
    const value = this.result();
    if (value && value.page < value.totalPages) this.loadCustomers(value.page + 1);
  }

  protected openCreate(): void {
    this.error.set(null);
    this.editing.set(null);
    this.form = emptyCustomerForm();
    this.formMode.set('create');
  }

  protected openEdit(customer: Customer): void {
    if (!this.canWrite() || customer.isGeneric) return;
    this.error.set(null);
    this.editing.set(customer);
    this.form = {
      customerType: customer.customerType ?? 'PERSON',
      customerStage: customer.customerStage,
      name: customer.name,
      documentType: customer.documentType ?? '',
      documentNumber: customer.documentNumber ?? '',
      tradeName: customer.tradeName ?? '',
      contactName: customer.contactName ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      internalNotes: customer.internalNotes ?? '',
    };
    this.formMode.set('edit');
  }

  protected closeForm(): void {
    if (this.actionLoading()) return;
    this.formMode.set(null);
    this.editing.set(null);
    this.error.set(null);
  }

  protected submitCustomer(event: Event): void {
    event.preventDefault();
    const validation = validateCustomer(this.form);
    if (validation) {
      this.error.set(validation);
      return;
    }

    const mode = this.formMode();
    const editing = this.editing();
    let request$: Observable<Customer>;
    if (mode === 'create') {
      const request: CreateCustomerRequest = {
        customerType: this.form.customerType,
        customerStage: this.form.customerStage,
        name: this.form.name.trim(),
        ...documentFields(this.form),
        ...optionalCustomerFields(this.form),
      };
      request$ = this.commercial.createCustomer(request);
    } else if (mode === 'edit' && editing) {
      const request: UpdateCustomerRequest = {
        name: this.form.name.trim(),
        documentType: this.form.documentType || null,
        documentNumber: this.form.documentNumber.trim() || null,
        tradeName: this.form.tradeName.trim() || null,
        contactName: this.form.contactName.trim() || null,
        email: this.form.email.trim() || null,
        phone: this.form.phone.trim() || null,
        address: this.form.address.trim() || null,
        internalNotes: this.form.internalNotes.trim() || null,
      };
      request$ = this.commercial.updateCustomer(editing.id, request);
    } else {
      return;
    }

    this.actionLoading.set(true);
    this.error.set(null);
    request$.pipe(take(1), finalize(() => this.actionLoading.set(false))).subscribe({
      next: customer => {
        this.formMode.set(null);
        this.editing.set(null);
        this.notice.set(mode === 'create' ? `${customer.name} fue agregado.` : `${customer.name} fue actualizado.`);
        this.loadCustomers(mode === 'create' ? 1 : (this.result()?.page ?? 1));
      },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }

  protected askAction(action: CustomerAction, customer: Customer): void {
    this.error.set(null);
    this.pendingAction.set({ action, customer });
  }

  protected runAction(): void {
    const pending = this.pendingAction();
    if (!pending) return;
    this.actionLoading.set(true);
    this.commercial.changeCustomerState(pending.customer.id, pending.action).pipe(
      take(1),
      finalize(() => this.actionLoading.set(false)),
    ).subscribe({
      next: customer => {
        this.pendingAction.set(null);
        this.notice.set(actionSuccess(pending.action, customer.name));
        this.loadCustomers(this.result()?.page ?? 1);
      },
      error: error => {
        this.pendingAction.set(null);
        this.error.set(requestErrorMessage(error));
      },
    });
  }

  protected typeLabel(value: CustomerType | null): string {
    if (value === 'PERSON') return 'Persona';
    if (value === 'COMPANY') return 'Empresa';
    return 'General';
  }

  protected stageLabel(value: CustomerStage): string {
    return value === 'PROSPECT' ? 'Prospecto' : 'Cliente';
  }

  protected statusLabel(value: CustomerStatus): string {
    return { ACTIVE: 'Activo', INACTIVE: 'Inactivo', BLOCKED: 'Bloqueado' }[value];
  }

  protected statusClass(value: CustomerStatus): string {
    return value === 'ACTIVE' ? 'badge--ok' : value === 'BLOCKED' ? 'badge--danger' : 'badge--neutral';
  }

  protected range(): string {
    return pageRange(this.result());
  }

  protected visibleStageCount(stage: CustomerStage): number {
    return this.result()?.data.filter(customer => customer.customerStage === stage).length ?? 0;
  }

  protected visibleStatusCount(status: CustomerStatus): number {
    return this.result()?.data.filter(customer => customer.status === status).length ?? 0;
  }

  protected actionTitle(): string {
    const pending = this.pendingAction();
    if (!pending) return '';
    return {
      activate: 'Activar cliente',
      deactivate: 'Desactivar cliente',
      block: 'Bloquear cliente',
      unblock: 'Desbloquear cliente',
      'convert-to-customer': 'Convertir prospecto',
    }[pending.action];
  }

  protected actionDescription(): string {
    const pending = this.pendingAction();
    if (!pending) return '';
    const messages: Record<CustomerAction, string> = {
      activate: `${pending.customer.name} volverá a estar disponible para operaciones comerciales.`,
      deactivate: `${pending.customer.name} dejará de estar disponible para nuevas operaciones.`,
      block: `${pending.customer.name} no podrá mantener saldos pendientes.`,
      unblock: `${pending.customer.name} recuperará sus condiciones habituales.`,
      'convert-to-customer': `${pending.customer.name} dejará de ser prospecto y pasará a ser cliente.`,
    };
    return messages[pending.action];
  }

  protected loadCustomers(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.commercial.listCustomers({
      page,
      limit: this.pageSize,
      ...(this.search.trim() ? { search: this.search.trim() } : {}),
      ...(this.status ? { status: this.status as CustomerStatus } : {}),
      ...(this.customerType ? { customerType: this.customerType as CustomerType } : {}),
      ...(this.customerStage ? { customerStage: this.customerStage as CustomerStage } : {}),
    }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: result => this.result.set(result),
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
}

function emptyCustomerForm(): CustomerForm {
  return {
    customerType: 'PERSON', customerStage: 'CUSTOMER', name: '', documentType: '', documentNumber: '',
    tradeName: '', contactName: '', email: '', phone: '', address: '', internalNotes: '',
  };
}

function validateCustomer(form: CustomerForm): string | null {
  if (!form.name.trim()) return 'Ingresa el nombre del cliente.';
  if (form.name.trim().length > 150) return 'El nombre no puede superar 150 caracteres.';
  if (Boolean(form.documentType) !== Boolean(form.documentNumber.trim())) return 'Completa el tipo y número de documento, o deja ambos vacíos.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Ingresa un correo válido.';
  if (form.internalNotes.trim().length > 1000) return 'Las notas no pueden superar 1000 caracteres.';
  return null;
}

function documentFields(form: CustomerForm): Partial<CreateCustomerRequest> {
  return form.documentType && form.documentNumber.trim()
    ? { documentType: form.documentType, documentNumber: form.documentNumber.trim() }
    : {};
}

function optionalCustomerFields(form: CustomerForm): Partial<CreateCustomerRequest> {
  return {
    ...(form.tradeName.trim() ? { tradeName: form.tradeName.trim() } : {}),
    ...(form.contactName.trim() ? { contactName: form.contactName.trim() } : {}),
    ...(form.email.trim() ? { email: form.email.trim() } : {}),
    ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    ...(form.address.trim() ? { address: form.address.trim() } : {}),
    ...(form.internalNotes.trim() ? { internalNotes: form.internalNotes.trim() } : {}),
  };
}

function actionSuccess(action: CustomerAction, name: string): string {
  return {
    activate: `${name} fue activado.`, deactivate: `${name} fue desactivado.`, block: `${name} fue bloqueado.`,
    unblock: `${name} fue desbloqueado.`, 'convert-to-customer': `${name} ahora es cliente.`,
  }[action];
}
