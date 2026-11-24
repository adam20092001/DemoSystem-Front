import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { requestErrorMessage } from '../commercial/commercial.util';
import { LocationsService, StockLocation, Warehouse } from './locations.service';

@Component({
  selector: 'app-warehouses',
  imports: [FormsModule],
  templateUrl: './warehouses.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarehousesPage implements OnInit {
  private readonly api = inject(LocationsService);
  private readonly auth = inject(AuthService);
  protected readonly canWrite = computed(() => this.auth.role() === 'ADMIN');
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly locations = signal<StockLocation[]>([]);
  protected readonly selected = signal<Warehouse | null>(null);
  protected readonly error = visibleErrorSignal();
  protected readonly notice = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly locationFormOpen = signal(false);
  protected readonly editing = signal<Warehouse | StockLocation | null>(null);
  protected form = { code: '', name: '', description: '' };

  ngOnInit(): void { this.load(); }
  protected load(): void {
    this.loading.set(true);
    this.api.warehouses().pipe(take(1), finalize(() => this.loading.set(false))).subscribe({
      next: result => { this.warehouses.set(result.data); const selected = this.selected(); if (selected) { const current = result.data.find(item => item.id === selected.id); if (current) this.select(current); } },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected select(warehouse: Warehouse): void {
    this.selected.set(warehouse);
    this.api.locations(warehouse.id).pipe(take(1)).subscribe({
      next: result => this.locations.set(result.data),
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected openWarehouse(warehouse?: Warehouse): void {
    this.editing.set(warehouse ?? null); this.form = { code: warehouse?.code ?? '', name: warehouse?.name ?? '', description: warehouse?.description ?? '' }; this.formOpen.set(true);
  }
  protected openLocation(location?: StockLocation): void {
    this.editing.set(location ?? null); this.form = { code: location?.code ?? '', name: location?.name ?? '', description: location?.description ?? '' }; this.locationFormOpen.set(true);
  }
  protected save(): void {
    const name = this.form.name.trim(); const code = this.form.code.trim().toUpperCase();
    if (!name || (!this.editing() && !code)) { this.error.set('Completa el código y nombre.'); return; }
    const body = { name, description: this.form.description.trim() || undefined };
    const updateBody = { name, description: this.form.description.trim() || null };
    const editing = this.editing(); const parent = this.selected();
    const request = this.locationFormOpen()
      ? editing && parent ? this.api.updateLocation(parent.id, editing.id, updateBody) : parent ? this.api.createLocation(parent.id, { ...body, code }) : null
      : editing ? this.api.updateWarehouse(editing.id, updateBody) : this.api.createWarehouse({ ...body, code });
    if (!request) return;
    this.saving.set(true); this.error.set(null);
    request.pipe(take(1), finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.formOpen.set(false); this.locationFormOpen.set(false); this.notice.set('Guardado correctamente.'); if (this.selected()) this.select(this.selected()!); this.load(); },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected toggleWarehouse(item: Warehouse): void {
    if (!confirm(`¿${item.status === 'ACTIVE' ? 'Desactivar' : 'Activar'} ${item.name}?`)) return;
    this.api.setWarehouseActive(item.id, item.status !== 'ACTIVE').pipe(take(1)).subscribe({ next: () => this.load(), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected toggleLocation(item: StockLocation): void {
    const parent = this.selected(); if (!parent) return;
    if (!confirm(`¿${item.status === 'ACTIVE' ? 'Desactivar' : 'Activar'} ${item.name}?`)) return;
    this.api.setLocationActive(parent.id, item.id, item.status !== 'ACTIVE').pipe(take(1)).subscribe({ next: () => this.select(parent), error: error => this.error.set(requestErrorMessage(error)) });
  }
}
