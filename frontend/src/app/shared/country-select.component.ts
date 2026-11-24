import { ChangeDetectionStrategy, Component, Injectable, computed, inject, input, output, signal } from '@angular/core';
import { finalize, take } from 'rxjs';
import { ApiClient } from '../core/http/api-client.service';
import { AuthService } from '../core/auth/auth.service';
import { requestErrorMessage } from '../features/commercial/commercial.util';

export interface Country { code: string; name: string; active: boolean; pendingReview: boolean }
@Injectable({ providedIn: 'root' })
export class CountriesService {
  private readonly api = inject(ApiClient);
  readonly records = signal<Country[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  private loaded = false;
  load(): void {
    if (this.loaded || this.loading()) return;
    this.loading.set(true); this.error.set(null);
    this.api.get<Country[]>('countries', { includeInactive: true }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: items => { this.records.set(items); this.loaded = true; }, error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  name(code: string): string { return this.records().find(item => item.code === code)?.name ?? code; }
  add(code: string, name: string, done: (code: string) => void, failed: (error: unknown) => void): void {
    this.saving.set(true);
    this.api.post<Country>('countries', { code: code.trim().toUpperCase(), name: name.trim() }).pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: item => { this.records.update(items => [...items, item]); done(item.code); }, error: failed,
    });
  }
}
@Component({
  selector: 'app-country-select',
  template: `
    <select #countryInput class="input" [value]="value() || ''" (change)="choose(countryInput)" [attr.aria-label]="label()" [required]="required()" [disabled]="countries.loading()">
      <option value="">{{ countries.loading() ? 'Cargando países…' : 'Seleccionar país' }}</option>
      @for (country of options(); track country.code) { <option [value]="country.code" [selected]="value() === country.code">{{ country.name }}{{ !country.active ? ' (inactivo)' : '' }}</option> }
      @if (canCreate()) { <option value="__add">＋ Agregar país</option> }
    </select>
    @if (countries.error()) { <small class="field-validation-message">{{ countries.error() }}</small><button class="btn btn--quiet" type="button" (click)="countries.load()">Reintentar consulta</button> }
    @if (adding()) {
      <div class="country-add" data-validation-scope>
        <label class="field"><span>Código ISO *</span><input #code data-api-field="code" class="input" maxlength="2" pattern="[A-Za-z]{2}" placeholder="Ej.: US" aria-label="Código del nuevo país"></label>
        <label class="field"><span>Nombre del país *</span><input #name data-api-field="name" class="input" maxlength="100" aria-label="Nombre del nuevo país"></label>
        @if (saveError()) { <small class="field-validation-message">{{ saveError() }}</small> }
        <div><button class="btn btn--primary" type="button" [disabled]="countries.saving()" (click)="saveCountry(code.value, name.value)">{{ countries.saving() ? 'Guardando…' : 'Guardar país' }}</button><button class="btn btn--quiet" type="button" (click)="adding.set(false)">Cancelar</button></div>
      </div>
    }
  `,
  styles: [':host{display:block;min-width:0}.country-add{display:grid;gap:8px;margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:8px}.country-add > div{display:flex;gap:6px;flex-wrap:wrap}'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountrySelectComponent {
  protected readonly countries = inject(CountriesService);
  private readonly auth = inject(AuthService);
  protected readonly canCreate = computed(() => ['ADMIN', 'PURCHASING'].includes(this.auth.role()));
  readonly value = input<string | undefined>('');
  readonly valueChange = output<string>();
  readonly label = input('País');
  readonly required = input(false);
  protected readonly adding = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected saveCountry(code: string, name: string): void { this.saveError.set(null); this.countries.add(code, name, this.countryAdded, error => this.saveError.set(requestErrorMessage(error))); }
  protected readonly options = computed(() => {
    const items = this.countries.records().filter(item => item.active || item.code === this.value());
    if (this.value() && !items.some(item => item.code === this.value())) items.push({ code: this.value()!, name: this.value()!, active: false, pendingReview: true });
    return items.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });
  protected readonly countryAdded = (code: string) => { this.valueChange.emit(code); this.adding.set(false); };
  constructor() { this.countries.load(); }
  protected choose(select: HTMLSelectElement): void { if (select.value === '__add') { select.value = this.value() || ''; this.adding.set(true); return; } this.valueChange.emit(select.value); }
}
