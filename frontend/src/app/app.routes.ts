import { Routes } from '@angular/router';
import { AppShellComponent } from './layout/app-shell/app-shell.component';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage) },
  { path: '', component: AppShellComponent, canActivate: [authGuard], children: [
    { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage) },
    { path: 'pos', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER'], title: 'Punto de venta', eyebrow: 'Ventas', description: 'Venta directa, carrito técnico y pago inicial en un solo flujo.' }, loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage) },
    { path: 'products', data: { title: 'Productos', eyebrow: 'Catálogo', description: 'Productos, servicios, especificaciones e imágenes.' }, loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage) },
    { path: 'inventory', canActivate: [roleGuard], data: { roles: ['ADMIN', 'WAREHOUSE', 'MANAGEMENT'], title: 'Inventario', eyebrow: 'Operaciones', description: 'Stock actual, movimientos trazables y alertas de mínimo.' }, loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage) },
    { path: 'customers', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'MANAGEMENT'], title: 'Clientes', eyebrow: 'Comercial', description: 'Personas, empresas, prospectos e historial comercial.' }, loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage) },
    { path: 'quotes', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'MANAGEMENT'], title: 'Cotizaciones', eyebrow: 'Comercial', description: 'Propuestas con vigencia, estados y conversión a venta.' }, loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage) },
    { path: 'sales', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'MANAGEMENT'], title: 'Ventas', eyebrow: 'Comercial', description: 'Notas de venta internas, pagos y estado de entrega.' }, loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage) },
    { path: 'payments', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'MANAGEMENT'], title: 'Pagos', eyebrow: 'Cobranza', description: 'Pagos parciales, saldos y cuentas por cobrar.' }, loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage) },
    { path: 'reports', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT'], title: 'Reportes', eyebrow: 'Inteligencia', description: 'Diez reportes operativos con filtros y totales.' }, loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage) },
    { path: 'settings', canActivate: [roleGuard], data: { roles: ['ADMIN'], title: 'Configuración', eyebrow: 'Administración', description: 'Empresa, moneda, IGV, parámetros y correlativos.' }, loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage) },
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  ]},
  { path: '**', redirectTo: 'dashboard' },
];
