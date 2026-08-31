import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiRequestError } from '../../core/errors/api-request.error';
import { CompanySettings, DocumentSequence, UpdateCompanySettings, UpdateDocumentSequence } from './settings.model';
import { SettingsService } from './settings.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnInit {
  private readonly service = inject(SettingsService);
  protected readonly auth = inject(AuthService);
  protected readonly canEdit = computed(() => this.auth.role() === 'ADMIN');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly sequences = signal<DocumentSequence[]>([]);
  protected form: UpdateCompanySettings = emptySettings();
  protected sequenceForms: Record<string, UpdateDocumentSequence> = {};

  ngOnInit(): void { this.load(); }

  protected saveConfiguration(event: Event): void {
    event.preventDefault();
    const validation = validate(this.form);
    if (validation) { this.error.set(validation); return; }
    this.saving.set(true);
    this.error.set(null);
    this.service.updateConfiguration(normalize(this.form)).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: settings => {
        this.form = toForm(settings);
        this.notice.set('La configuración de la empresa fue actualizada.');
      },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  protected saveSequence(sequence: DocumentSequence): void {
    const form = this.sequenceForms[sequence.documentType];
    if (!form.prefix.trim() || form.prefix.trim().length > 10) { this.error.set('El prefijo debe tener entre 1 y 10 caracteres.'); return; }
    if (!Number.isInteger(form.padding) || form.padding < 1 || form.padding > 12) { this.error.set('La longitud debe ser un entero entre 1 y 12.'); return; }
    if (!Number.isInteger(form.currentNumber) || form.currentNumber < sequence.currentNumber) { this.error.set('El correlativo no puede ser menor que el último número emitido.'); return; }
    this.saving.set(true);
    this.error.set(null);
    this.service.updateSequence(sequence.documentType, { ...form, prefix: form.prefix.trim() }).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: updated => {
        this.sequences.update(items => items.map(item => item.id === updated.id ? updated : item));
        this.sequenceForms[updated.documentType] = sequenceForm(updated);
        this.notice.set(`El correlativo de ${this.sequenceLabel(updated.documentType).toLowerCase()} fue actualizado.`);
      },
      error: error => this.error.set(errorMessage(error)),
    });
  }

  protected sequenceLabel(type: string): string { return type === 'QUOTE' ? 'Cotizaciones' : 'Ventas'; }
  protected nextPreview(sequence: DocumentSequence): string {
    const form = this.sequenceForms[sequence.documentType] ?? sequence;
    return `${form.prefix}${String(form.currentNumber + 1).padStart(form.padding, '0')}`;
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ settings: this.service.getConfiguration(), sequences: this.service.listSequences() })
      .pipe(take(1), finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ settings, sequences }) => {
          this.form = toForm(settings);
          this.sequences.set(sequences);
          this.sequenceForms = Object.fromEntries(sequences.map(item => [item.documentType, sequenceForm(item)]));
        },
        error: error => this.error.set(errorMessage(error)),
      });
  }
}

function emptySettings(): UpdateCompanySettings {
  return { businessName: '', tradeName: null, taxId: null, address: null, phone: null, email: null, currencyCode: 'PEN', currencySymbol: 'S/', taxEnabled: false, taxRate: '18.00', quoteValidityDays: 15, maxDiscountPercent: '100.00' };
}
function toForm(value: CompanySettings): UpdateCompanySettings { const { id: _id, createdAt: _created, updatedAt: _updated, ...form } = value; return { ...form }; }
function sequenceForm(value: DocumentSequence): UpdateDocumentSequence { return { prefix: value.prefix, padding: value.padding, currentNumber: value.currentNumber }; }
function normalize(value: UpdateCompanySettings): UpdateCompanySettings {
  const nullable = (text: string | null): string | null => text?.trim() || null;
  return { ...value, businessName: value.businessName.trim(), tradeName: nullable(value.tradeName), taxId: nullable(value.taxId), address: nullable(value.address), phone: nullable(value.phone), email: nullable(value.email), currencyCode: value.currencyCode.trim().toUpperCase(), currencySymbol: value.currencySymbol.trim(), taxRate: value.taxRate.trim(), maxDiscountPercent: value.maxDiscountPercent.trim() };
}
function validate(value: UpdateCompanySettings): string | null {
  if (!value.businessName.trim()) return 'Ingresa la razón social.';
  if (!/^[A-Za-z]{3}$/.test(value.currencyCode.trim())) return 'La moneda debe ser un código de tres letras, por ejemplo PEN.';
  if (!value.currencySymbol.trim() || value.currencySymbol.trim().length > 5) return 'Ingresa un símbolo monetario de hasta 5 caracteres.';
  if (!Number.isInteger(value.quoteValidityDays) || value.quoteValidityDays < 1) return 'La vigencia de cotizaciones debe ser de al menos un día.';
  if (!validPercent(value.taxRate) || (value.taxEnabled && Number(value.taxRate) <= 0)) return 'La tasa de IGV debe estar entre 0 y 100; si está activo, debe ser mayor que cero.';
  if (!validPercent(value.maxDiscountPercent)) return 'El descuento máximo debe estar entre 0 y 100.';
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) return 'Ingresa un correo válido.';
  return null;
}
function validPercent(value: string): boolean { return /^\d{1,3}(\.\d{1,2})?$/.test(value.trim()) && Number(value) <= 100; }
function errorMessage(error: unknown): string { return error instanceof ApiRequestError ? error.message : 'No se pudo completar la operación.'; }
