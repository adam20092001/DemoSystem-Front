import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { requestErrorMessage } from '../commercial/commercial.util';
import { SaveSupplierRequest, Supplier, SupplierDocumentType } from './procurement.model';
import { ProcurementService } from './procurement.service';

@Component({
  selector: 'app-suppliers', imports: [FormsModule],
  templateUrl: './suppliers.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './procurement.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuppliersPage implements OnInit {
  private readonly api = inject(ProcurementService);
  protected readonly auth = inject(AuthService);
  protected readonly canWrite = computed(() => this.auth.role() === 'ADMIN');
  protected readonly result = signal<PaginatedResponse<Supplier> | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = visibleErrorSignal();
  protected readonly notice = signal<string | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Supplier | null>(null);
  protected search = '';
  protected status = '';
  protected documentType = '';
  protected pageSize = 20;
  protected form = emptySupplierForm();

  ngOnInit(): void { this.load(); }
  protected load(page = 1): void {
    this.loading.set(true); this.error.set(null);
    this.api.listSuppliers({ page, limit: this.pageSize, search: this.search, status: this.status, documentType: this.documentType })
      .pipe(take(1), finalize(() => this.loading.set(false)))
      .subscribe({ next: value => this.result.set(value), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected apply(event: Event): void { event.preventDefault(); this.load(1); }
  protected clear(): void { this.search = ''; this.status = ''; this.documentType = ''; this.load(1); }
  protected openCreate(): void { this.editing.set(null); this.form = emptySupplierForm(); this.formOpen.set(true); }
  protected openEdit(item: Supplier): void {
    this.editing.set(item);
    this.form = {
      documentType: item.documentType, documentNumber: item.documentNumber, countryCode: item.countryCode,
      legalName: item.legalName, tradeName: item.tradeName ?? '', contactName: item.contactName ?? '', phone: item.phone ?? '',
      email: item.email ?? '', address: item.address ?? '', internalNotes: item.internalNotes ?? '', defaultCurrencyCode: item.defaultCurrencyCode ?? '',
    };
    this.formOpen.set(true);
  }
  protected save(): void {
    const body: SaveSupplierRequest = cleanSupplier(this.form);
    if (!body.documentNumber || !body.legalName) { this.error.set('Documento y razón social son obligatorios.'); return; }
    this.saving.set(true); this.error.set(null);
    const request = this.editing() ? this.api.updateSupplier(this.editing()!.id, body) : this.api.createSupplier(body);
    request.pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.formOpen.set(false); this.notice.set(this.editing() ? 'Proveedor actualizado.' : 'Proveedor registrado.'); this.load(this.result()?.page ?? 1); },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected toggle(item: Supplier): void {
    this.api.setSupplierActive(item.id, item.status !== 'ACTIVE').pipe(take(1)).subscribe({
      next: () => { this.notice.set(item.status === 'ACTIVE' ? 'Proveedor desactivado.' : 'Proveedor activado.'); this.load(this.result()?.page ?? 1); },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected previous(): void { const page = this.result()?.page ?? 1; if (page > 1) this.load(page - 1); }
  protected next(): void { const r = this.result(); if (r && r.page < r.totalPages) this.load(r.page + 1); }
  protected documentLabel(type: SupplierDocumentType): string { return ({ RUC: 'RUC', DNI: 'DNI', FOREIGN_TAX_ID: 'ID fiscal extranjero', OTHER: 'Otro' })[type]; }
}

function emptySupplierForm(): SaveSupplierRequest { return { documentType: 'RUC', documentNumber: '', countryCode: 'PE', legalName: '', tradeName: '', contactName: '', phone: '', email: '', address: '', internalNotes: '', defaultCurrencyCode: 'PEN' }; }
function cleanSupplier(form: SaveSupplierRequest): SaveSupplierRequest {
  const optional = (value?: string) => value?.trim() || undefined;
  return { documentType: form.documentType, documentNumber: form.documentNumber.trim(), countryCode: (form.countryCode || 'PE').trim().toUpperCase(), legalName: form.legalName.trim(), tradeName: optional(form.tradeName), contactName: optional(form.contactName), phone: optional(form.phone), email: optional(form.email), address: optional(form.address), internalNotes: optional(form.internalNotes), defaultCurrencyCode: optional(form.defaultCurrencyCode)?.toUpperCase() };
}
