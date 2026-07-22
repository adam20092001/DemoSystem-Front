import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../core/auth/auth.service';
import { NavigationItem, UserRole } from '../../core/models/navigation.model';

/** Iconos de trazo (24px, stroke 1.8) — un solo estilo para toda la navegación. */
const ICONS: Record<string, string> = {
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM4 13h7v7H4z"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21 8H6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  layers: '<path d="M12 3 2 8l10 5 10-5z"/><path d="M2 13l10 5 10-5M2 18l10 5 10-5"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0M16 5.5a3.2 3.2 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  receipt: '<path d="M5 3h14v18l-2.3-1.5L14 21l-2-1.4L10 21l-2.7-1.5L5 21z"/><path d="M9 8h6M9 12h6"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h14V9H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14" r="1.2"/>',
  chart: '<path d="M4 20V4M4 20h16M8 20v-6M12 20v-9M16 20v-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.4H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 6.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 .9 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  SELLER: 'Vendedor',
  WAREHOUSE: 'Almacén',
  MANAGEMENT: 'Gerencia',
};

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly menuOpen = signal(false);
  protected readonly roles: UserRole[] = ['ADMIN', 'SELLER', 'WAREHOUSE', 'MANAGEMENT'];

  protected readonly nav: NavigationItem[] = [
    { label: 'Resumen', route: '/dashboard', icon: 'grid', roles: this.roles },
    { label: 'Punto de venta', route: '/pos', icon: 'cart', roles: ['ADMIN', 'SELLER'] },
    { label: 'Productos', route: '/products', icon: 'box', roles: this.roles },
    { label: 'Inventario', route: '/inventory', icon: 'layers', roles: ['ADMIN', 'WAREHOUSE', 'MANAGEMENT'] },
    { label: 'Clientes', route: '/customers', icon: 'users', roles: ['ADMIN', 'SELLER', 'MANAGEMENT'] },
    { label: 'Cotizaciones', route: '/quotes', icon: 'file', roles: ['ADMIN', 'SELLER', 'MANAGEMENT'] },
    { label: 'Ventas', route: '/sales', icon: 'receipt', roles: ['ADMIN', 'SELLER', 'MANAGEMENT'] },
    { label: 'Pagos', route: '/payments', icon: 'wallet', roles: ['ADMIN', 'SELLER', 'MANAGEMENT'] },
    { label: 'Reportes', route: '/reports', icon: 'chart', roles: ['ADMIN', 'MANAGEMENT'] },
    { label: 'Configuración', route: '/settings', icon: 'settings', roles: ['ADMIN'] },
  ];

  protected readonly visibleNav = computed(() => this.nav.filter(item => item.roles.includes(this.auth.role())));

  protected readonly initials = computed(() =>
    this.auth.userName().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
  );

  private readonly iconCache = new Map<string, SafeHtml>();

  protected icon(name: string): SafeHtml {
    if (!this.iconCache.has(name)) {
      const body = ICONS[name] ?? ICONS['grid'];
      const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
      this.iconCache.set(name, this.sanitizer.bypassSecurityTrustHtml(svg));
    }
    return this.iconCache.get(name)!;
  }

  protected roleLabel(role: UserRole): string {
    return ROLE_LABELS[role];
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
