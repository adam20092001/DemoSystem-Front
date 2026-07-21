import { Routes } from '@angular/router';
import { AppShellComponent } from './layout/app-shell/app-shell.component';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage) },
  { path: '', component: AppShellComponent, children: [
    { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage) },
    { path: 'pos', loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage), data: { title: 'Punto de venta', eyebrow: 'Ventas', description: 'Venta directa, carrito técnico y pago inicial en un solo flujo.' } },
    { path: 'products', loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage), data: { title: 'Productos', eyebrow: 'Catálogo', description: 'Productos, servicios, especificaciones e imágenes.' } },
    { path: 'inventory', loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage), data: { title: 'Inventario', eyebrow: 'Operaciones', description: 'Stock actual, movimientos trazables y alertas de mínimo.' } },
    { path: 'customers', loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage), data: { title: 'Clientes', eyebrow: 'Comercial', description: 'Personas, empresas, prospectos e historial comercial.' } },
    { path: 'quotes', loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage), data: { title: 'Cotizaciones', eyebrow: 'Comercial', description: 'Propuestas con vigencia, estados y conversión a venta.' } },
    { path: 'sales', loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage), data: { title: 'Ventas', eyebrow: 'Comercial', description: 'Notas de venta internas, pagos y estado de entrega.' } },
    { path: 'payments', loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage), data: { title: 'Pagos', eyebrow: 'Cobranza', description: 'Pagos parciales, saldos y cuentas por cobrar.' } },
    { path: 'reports', loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage), data: { title: 'Reportes', eyebrow: 'Inteligencia', description: 'Diez reportes operativos con filtros y totales.' } },
    { path: 'settings', loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage), data: { title: 'Configuración', eyebrow: 'Administración', description: 'Empresa, moneda, IGV, parámetros y correlativos.' } },
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  ]},
  { path: '**', redirectTo: 'dashboard' },
];
