import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'brand';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  protected readonly metrics = [
    { label: 'Ventas de hoy', value: 'S/ 8,460.50', note: '18 operaciones', delta: '+12.4%', tone: 'ok' as Tone },
    { label: 'Cobros de hoy', value: 'S/ 6,280.00', note: '74% de lo vendido', delta: '+8.1%', tone: 'info' as Tone },
    { label: 'Por cobrar', value: 'S/ 14,320.00', note: '7 clientes con saldo', delta: '3 vencidos', tone: 'danger' as Tone },
    { label: 'Stock bajo', value: '6 productos', note: 'bajo el mínimo', delta: '2 críticos', tone: 'warn' as Tone },
  ];

  protected readonly week = [
    { day: 'Lun', pct: 48 }, { day: 'Mar', pct: 68 }, { day: 'Mié', pct: 55 }, { day: 'Jue', pct: 82 },
    { day: 'Vie', pct: 74 }, { day: 'Sáb', pct: 92 }, { day: 'Dom', pct: 40 },
  ];

  protected readonly pipeline = [
    { label: 'Pendientes', count: 10, tone: 'warn' as Tone },
    { label: 'Aceptadas', count: 7, tone: 'ok' as Tone },
    { label: 'Convertidas', count: 5, tone: 'info' as Tone },
    { label: 'Vencidas', count: 2, tone: 'danger' as Tone },
  ];

  protected readonly activity = [
    { code: 'NV-000124', client: 'Constructora San Miguel', time: '10:42', amount: 'S/ 4,820.00', status: 'Pagada', tone: 'ok' as Tone },
    { code: 'NV-000123', client: 'Carlos Mendoza', time: '10:18', amount: 'S/ 680.00', status: 'Parcial', tone: 'warn' as Tone },
    { code: 'NV-000122', client: 'Público general', time: '09:56', amount: 'S/ 245.50', status: 'Pagada', tone: 'ok' as Tone },
    { code: 'NV-000121', client: 'Grupo Técnico Andino', time: '09:31', amount: 'S/ 1,940.00', status: 'Pendiente', tone: 'danger' as Tone },
  ];

  protected readonly attention = [
    { route: '/inventory', label: '2 productos sin stock', tone: 'danger' as Tone },
    { route: '/payments', label: '3 cobros vencidos', tone: 'warn' as Tone },
    { route: '/quotes', label: '4 cotizaciones por vencer', tone: 'info' as Tone },
  ];

  protected readonly weekTotal = 'S/ 42,680';

  /** Ángulos acumulados para el gráfico de dona de cotizaciones. */
  protected get donut(): { gradient: string; total: number } {
    const total = this.pipeline.reduce((sum, p) => sum + p.count, 0);
    const colors: Record<Tone, string> = {
      ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', info: 'var(--info)', brand: 'var(--brand)',
    };
    let acc = 0;
    const stops = this.pipeline.map(p => {
      const from = (acc / total) * 100;
      acc += p.count;
      const to = (acc / total) * 100;
      return `${colors[p.tone]} ${from}% ${to}%`;
    });
    return { gradient: `conic-gradient(${stops.join(', ')})`, total };
  }
}
