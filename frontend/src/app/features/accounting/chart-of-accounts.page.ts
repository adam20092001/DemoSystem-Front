import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { requestErrorMessage } from '../commercial/commercial.util';
import { AccountType, AccountingSystemKey, ChartAccount } from './accounting.model';
import { AccountingService } from './accounting.service';

const AUTOMATIC_KEYS: AccountingSystemKey[] = ['ACCOUNTS_PAYABLE', 'VAT_RECEIVABLE', 'PURCHASE_RESALE_INVENTORY', 'PURCHASE_INTERNAL_CONSUMPTION', 'PURCHASE_FIXED_ASSET', 'PURCHASE_OPERATING_EXPENSE', 'PURCHASE_OTHER', 'COST_OF_GOODS_SOLD'];
@Component({ selector: 'app-chart-of-accounts', imports: [FormsModule], templateUrl: './chart-of-accounts.page.html', styleUrls: ['../commercial/commercial-page.shared.scss', './accounting.page.scss'], changeDetection: ChangeDetectionStrategy.OnPush })
export class ChartOfAccountsPage implements OnInit {
  private readonly api = inject(AccountingService); protected readonly auth = inject(AuthService); protected readonly canWrite = computed(() => this.auth.role() === 'ADMIN');
  protected readonly result = signal<PaginatedResponse<ChartAccount> | null>(null); protected readonly allAccounts = signal<ChartAccount[]>([]); protected readonly loading = signal(false); protected readonly error = visibleErrorSignal(); protected readonly notice = signal<string | null>(null); protected readonly formOpen = signal(false); protected readonly editing = signal<ChartAccount | null>(null); protected readonly automaticKeys = AUTOMATIC_KEYS;
  protected search = ''; protected type = ''; protected status = ''; protected form = emptyForm(); protected mapping: Record<string, string> = {};
  ngOnInit(): void { this.load(); }
  protected apply(event: Event): void { event.preventDefault(); this.load(); }
  @HostListener('submit', ['$event']) protected preventSubmit(event: Event): void { event.preventDefault(); }
  protected load(page = 1): void { this.loading.set(true); this.api.listChartAccounts({ page, limit: 100, search: this.search, type: this.type, status: this.status }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: value => { this.result.set(value); this.allAccounts.set(value.data); this.mapping = Object.fromEntries(AUTOMATIC_KEYS.map(key => [key, value.data.find(account => account.systemKey === key)?.id ?? ''])); }, error: e => this.error.set(requestErrorMessage(e)) }); }
  protected openCreate(): void { this.editing.set(null); this.form = emptyForm(); this.formOpen.set(true); }
  protected openEdit(account: ChartAccount): void { this.editing.set(account); this.form = { code: account.code, name: account.name, type: account.type, parentId: account.parentId ?? '', isPostable: account.isPostable }; this.formOpen.set(true); }
  protected save(): void { if (!this.form.code.trim() || !this.form.name.trim()) { this.error.set('Código y nombre son obligatorios.'); return; } const body = { code: this.form.code.trim(), name: this.form.name.trim(), type: this.form.type, parentId: this.form.parentId || undefined, isPostable: this.form.isPostable }; this.loading.set(true); const request = this.editing() ? this.api.updateChartAccount(this.editing()!.id, { name: body.name, type: body.type, parentId: body.parentId ?? null, isPostable: body.isPostable }) : this.api.createChartAccount(body); request.pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: () => { this.formOpen.set(false); this.notice.set('Cuenta guardada.'); this.load(); }, error: e => this.error.set(requestErrorMessage(e)) }); }
  protected toggle(account: ChartAccount): void { this.api.setChartAccountActive(account.id, account.status !== 'ACTIVE').pipe(take(1)).subscribe({ next: () => { this.notice.set('Estado actualizado.'); this.load(); }, error: e => this.error.set(requestErrorMessage(e)) }); }
  protected assign(key: AccountingSystemKey): void { const accountId = this.mapping[key]; if (!accountId) { this.error.set('Selecciona una cuenta destino.'); return; } this.api.assignSystemKey(key, accountId).pipe(take(1)).subscribe({ next: () => { this.notice.set(`Asignación ${this.keyLabel(key)} actualizada.`); this.load(); }, error: e => this.error.set(requestErrorMessage(e)) }); }
  protected keyLabel(key: AccountingSystemKey): string { return ({ ACCOUNTS_PAYABLE: 'Cuentas por pagar', VAT_RECEIVABLE: 'IGV crédito fiscal', PURCHASE_RESALE_INVENTORY: 'Mercadería para reventa', PURCHASE_INTERNAL_CONSUMPTION: 'Consumo interno', PURCHASE_FIXED_ASSET: 'Activos fijos', PURCHASE_OPERATING_EXPENSE: 'Gastos operativos', PURCHASE_OTHER: 'Otras compras', COST_OF_GOODS_SOLD: 'Costo de ventas' } as Record<string, string>)[key] ?? key; }
  protected typeLabel(type: AccountType): string { return ({ ASSET: 'Activo', LIABILITY: 'Pasivo', REVENUE: 'Ingreso', CONTRA_REVENUE: 'Contra ingreso', EQUITY: 'Patrimonio', EXPENSE: 'Gasto', COST: 'Costo' })[type]; }
  protected assignable(): ChartAccount[] { return this.allAccounts().filter(account => account.status === 'ACTIVE' && account.isPostable && (!account.systemKey || AUTOMATIC_KEYS.includes(account.systemKey))); }
}
function emptyForm(): { code: string; name: string; type: AccountType; parentId: string; isPostable: boolean } { return { code: '', name: '', type: 'ASSET', parentId: '', isPostable: true }; }
