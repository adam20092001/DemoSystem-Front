import { Routes } from '@angular/router';
import { AppShellComponent } from './layout/app-shell/app-shell.component';
import {
  authGuard,
  guestGuard,
  passwordChangeGuard,
  requiredPasswordChangeGuard,
} from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage) },
  { path: 'change-password', canActivate: [requiredPasswordChangeGuard], loadComponent: () => import('./features/auth/change-password.page').then(m => m.ChangePasswordPage) },
  { path: '', component: AppShellComponent, canActivate: [authGuard, passwordChangeGuard], children: [
    { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage) },
    { path: 'pos', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER'] }, loadComponent: () => import('./features/commercial/pos.page').then(m => m.PosPage) },
    { path: 'products', data: { title: 'Productos', eyebrow: 'Catálogo', description: 'Productos, servicios, especificaciones e imágenes.' }, loadComponent: () => import('./features/catalog/catalog.page').then(m => m.CatalogPage) },
    { path: 'inventory', canActivate: [roleGuard], data: { roles: ['ADMIN', 'WAREHOUSE', 'MANAGEMENT'] }, loadComponent: () => import('./features/inventory/inventory.page').then(m => m.InventoryPage) },
    { path: 'customers', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'MANAGEMENT'] }, loadComponent: () => import('./features/commercial/customers.page').then(m => m.CustomersPage) },
    { path: 'quotes', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'MANAGEMENT'] }, loadComponent: () => import('./features/commercial/quotes.page').then(m => m.QuotesPage) },
    { path: 'sales', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'MANAGEMENT'] }, loadComponent: () => import('./features/commercial/sales.page').then(m => m.SalesPage) },
    { path: 'payments', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'MANAGEMENT'] }, loadComponent: () => import('./features/commercial/payments.page').then(m => m.PaymentsPage) },
    { path: 'accounting', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT'] }, loadComponent: () => import('./features/accounting/accounting.page').then(m => m.AccountingPage) },
    { path: 'reports', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'SELLER'] }, loadComponent: () => import('./features/reports/reports.page').then(m => m.ReportsPage) },
    { path: 'users', canActivate: [roleGuard], data: { roles: ['ADMIN'] }, loadComponent: () => import('./features/users/users.page').then(m => m.UsersPage) },
    { path: 'settings', canActivate: [roleGuard], data: { roles: ['ADMIN'], title: 'Configuración', eyebrow: 'Administración', description: 'Empresa, moneda, IGV, parámetros y correlativos.' }, loadComponent: () => import('./features/placeholder/feature-placeholder.page').then(m => m.FeaturePlaceholderPage) },
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  ]},
  { path: '**', redirectTo: 'dashboard' },
];
