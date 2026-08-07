import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiRequestError } from '../../core/errors/api-request.error';
import { ApiClient } from '../../core/http/api-client.service';
import { CatalogService } from '../catalog/catalog.service';

interface HealthResponse {
  status: 'ok' | 'error';
  application: 'up' | 'down';
  database: 'up' | 'down';
  uptime: number;
  timestamp: string;
}

interface RealMetric {
  label: string;
  value: number;
  route: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiClient);
  private readonly catalog = inject(CatalogService);

  protected readonly metrics = signal<RealMetric[]>([]);
  protected readonly health = signal<HealthResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadRealData();
  }

  protected reload(): void {
    this.loadRealData();
  }

  protected healthLabel(value: 'up' | 'down' | undefined): string {
    if (value === 'up') return 'Disponible';
    if (value === 'down') return 'No disponible';
    return 'Pendiente';
  }

  private loadRealData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      products: this.catalog.listProducts({ page: 1, limit: 1, status: 'ACTIVE', productType: 'PRODUCT' }),
      services: this.catalog.listProducts({ page: 1, limit: 1, status: 'ACTIVE', productType: 'SERVICE' }),
      categories: this.catalog.listCategories({ page: 1, limit: 1, status: 'ACTIVE' }),
      units: this.catalog.listUnits({ page: 1, limit: 1, status: 'ACTIVE' }),
      health: this.api.get<HealthResponse>('health'),
    }).pipe(
      take(1),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: result => {
        this.metrics.set([
          { label: 'Productos activos', value: result.products.total, route: '/products' },
          { label: 'Servicios activos', value: result.services.total, route: '/products' },
          { label: 'Categorías activas', value: result.categories.total, route: '/products' },
          { label: 'Unidades activas', value: result.units.total, route: '/products' },
        ]);
        this.health.set(result.health);
      },
      error: error => {
        this.metrics.set([]);
        this.health.set(null);
        this.error.set(errorMessage(error));
      },
    });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof ApiRequestError
    ? error.message
    : 'No se pudo actualizar el resumen. Inténtalo nuevamente.';
}
