import { DateInputComponent } from '../../shared/date-input.component';
import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of, switchMap, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { money, requestErrorMessage, shortDate } from '../commercial/commercial.util';
import { DashboardQuoteStatus, DashboardResponse } from './dashboard.model';
import { DashboardService } from './dashboard.service';

@Component({
  selector: 'app-dashboard',
  imports: [DateInputComponent, FormsModule, RouterLink],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);

  protected readonly dashboard = signal<DashboardResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly previous = signal<DashboardResponse | null>(null);
  protected readonly updatedAt = signal('');
  protected readonly conversion = computed(() => {
    const quotes = this.dashboard()?.quotes;
    return quotes?.total ? Math.round((quotes.byStatus.find(x => x.status === 'CONVERTED')?.count ?? 0) / quotes.total * 100) : 0;
  });
  protected readonly quoteSegments = computed(() => {
    const quotes = this.dashboard()?.quotes;
    let offset = 0;
    return (quotes?.byStatus ?? []).map(item => {
      const share = quotes?.total ? item.count / quotes.total * 100 : 0;
      const result = { ...item, share, offset };
      offset += share;
      return result;
    });
  });
  protected readonly error = visibleErrorSignal();

  protected from = '';
  protected to = '';

  ngOnInit(): void {
    this.loadDashboard();
  }

  protected applyPeriod(event: Event): void {
    event.preventDefault();
    if ((this.from && !this.to) || (!this.from && this.to)) {
      this.error.set('Selecciona las dos fechas para consultar un período personalizado.');
      return;
    }
    if (this.from && this.to && this.from > this.to) {
      this.error.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    this.loadDashboard();
  }

  protected clearPeriod(): void {
    this.from = '';
    this.to = '';
    this.loadDashboard();
  }

  protected formatMoney(value: string | number): string {
    return money(value);
  }

  protected formatDate(value: string): string {
    return shortDate(value);
  }

  protected quoteStatusLabel(status: DashboardQuoteStatus): string {
    return {
      PENDING: 'Pendientes',
      ACCEPTED: 'Aceptadas',
      REJECTED: 'Rechazadas',
      EXPIRED: 'Vencidas',
      CONVERTED: 'Convertidas',
    }[status];
  }

  protected quoteShare(count: number, total: number): number {
    return total > 0 ? count / total * 100 : 0;
  }

  protected change(current: string | number, previous: string | number | undefined): string {
    if (previous === undefined || Number(previous) === 0) return 'Sin base comparable';
    const delta = (Number(current) - Number(previous)) / Number(previous) * 100;
    return `${delta > 0 ? '+' : ''}${delta.toLocaleString('es-PE', { maximumFractionDigits: 1 })}% vs. anterior`;
  }

  protected bar(value: string, other: string): number {
    const max = Math.max(Number(value), Number(other), Number(this.dashboard()?.sales?.total ?? 0), Number(this.dashboard()?.collections?.total ?? 0), Number(this.previous()?.sales?.total ?? 0), Number(this.previous()?.collections?.total ?? 0));
    return max > 0 ? Number(value) / max * 100 : 0;
  }

  protected stockCoverage(current: string, minimum: string): number {
    return Number(minimum) > 0 ? Math.min(100, Math.max(0, Number(current) / Number(minimum) * 100)) : 0;
  }

  protected setPeriod(days: number): void {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.from = localDate(start);
    this.to = localDate(end);
    this.loadDashboard();
  }

  protected loadDashboard(): void {
    this.loading.set(true);
    this.previous.set(null);
    this.error.set(null);
    this.dashboardService
      .getDashboard({
        ...(this.from ? { from: this.from } : {}),
        ...(this.to ? { to: this.to } : {}),
      })
      .pipe(
        switchMap(current => {
          const from = new Date(current.period.from.slice(0, 10) + 'T00:00:00Z');
          const to = new Date(current.period.to.slice(0, 10) + 'T00:00:00Z');
          const duration = to.getTime() - from.getTime() + 86400000;
          if (!Number.isFinite(duration) || duration <= 0) return of({ current, previous: null });
          return forkJoin({
            current: of(current),
            previous: this.dashboardService.getDashboard({
              from: new Date(from.getTime() - duration).toISOString().slice(0, 10),
              to: new Date(from.getTime() - 86400000).toISOString().slice(0, 10),
            }).pipe(catchError(() => of(null))),
          });
        }),
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ current, previous }) => {
          this.dashboard.set(current);
          this.previous.set(previous);
          this.updatedAt.set(new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }));
        },
        error: (error) => this.error.set(requestErrorMessage(error)),
      });
  }
}
