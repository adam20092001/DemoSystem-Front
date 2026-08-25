import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { money, requestErrorMessage, shortDate } from '../commercial/commercial.util';
import { DashboardQuoteStatus, DashboardResponse } from './dashboard.model';
import { DashboardService } from './dashboard.service';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);

  protected readonly dashboard = signal<DashboardResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

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

  protected loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);
    this.dashboardService
      .getDashboard({
        ...(this.from ? { from: this.from } : {}),
        ...(this.to ? { to: this.to } : {}),
      })
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (dashboard) => this.dashboard.set(dashboard),
        error: (error) => this.error.set(requestErrorMessage(error)),
      });
  }
}
