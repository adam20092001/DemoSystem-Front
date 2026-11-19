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
    { path: 'dashboard', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'WAREHOUSE', 'MANAGEMENT'] }, loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage) },
    { path: 'pos', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER'] }, loadComponent: () => import('./features/commercial/pos.page').then(m => m.PosPage) },
    { path: 'products', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'WAREHOUSE', 'MANAGEMENT'] }, loadComponent: () => import('./features/catalog/catalog.page').then(m => m.CatalogPage) },
    { path: 'inventory', canActivate: [roleGuard], data: { roles: ['ADMIN', 'WAREHOUSE', 'MANAGEMENT'] }, loadComponent: () => import('./features/inventory/inventory.page').then(m => m.InventoryPage) },
    { path: 'inventory-valuation', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'ACCOUNTANT'] }, loadComponent: () => import('./features/inventory/inventory-valuation.page').then(m => m.InventoryValuationPage) },
    { path: 'customers', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'MANAGEMENT'] }, loadComponent: () => import('./features/commercial/customers.page').then(m => m.CustomersPage) },
    { path: 'quotes', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'MANAGEMENT'] }, loadComponent: () => import('./features/commercial/quotes.page').then(m => m.QuotesPage) },
    { path: 'sales', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'MANAGEMENT'] }, loadComponent: () => import('./features/commercial/sales.page').then(m => m.SalesPage) },
    { path: 'payments', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'MANAGEMENT'] }, loadComponent: () => import('./features/commercial/payments.page').then(m => m.PaymentsPage) },
    { path: 'suppliers', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'ACCOUNTANT'] }, loadComponent: () => import('./features/procurement/suppliers.page').then(m => m.SuppliersPage) },
    { path: 'purchases', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'ACCOUNTANT'] }, loadComponent: () => import('./features/procurement/purchases.page').then(m => m.PurchasesPage) },
    { path: 'accounts-payable', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'ACCOUNTANT'] }, loadComponent: () => import('./features/procurement/accounts-payable.page').then(m => m.AccountsPayablePage) },
    { path: 'imports', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'ACCOUNTANT'] }, loadComponent: () => import('./features/imports/imports.page').then(m => m.ImportsPage) },
    { path: 'import-reports', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'ACCOUNTANT'] }, loadComponent: () => import('./features/imports/import-reports.page').then(m => m.ImportReportsPage) },
    { path: 'sire-demo', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'ACCOUNTANT'] }, loadComponent: () => import('./features/sire-demo/sire-demo.page').then(m => m.SireDemoPage) },
    { path: 'accounting', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'ACCOUNTANT'] }, loadComponent: () => import('./features/accounting/accounting.page').then(m => m.AccountingPage) },
    { path: 'chart-of-accounts', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'ACCOUNTANT'] }, loadComponent: () => import('./features/accounting/chart-of-accounts.page').then(m => m.ChartOfAccountsPage) },
    { path: 'accounting-periods', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'ACCOUNTANT'] }, loadComponent: () => import('./features/accounting/accounting-periods.page').then(m => m.AccountingPeriodsPage) },
    { path: 'manual-journals', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'ACCOUNTANT'] }, loadComponent: () => import('./features/accounting/manual-journals.page').then(m => m.ManualJournalsPage) },
    { path: 'accounting-reports', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'ACCOUNTANT'] }, loadComponent: () => import('./features/accounting/accounting-reports.page').then(m => m.AccountingReportsPage) },
    { path: 'reports', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT', 'SELLER'] }, loadComponent: () => import('./features/reports/reports.page').then(m => m.ReportsPage) },
    { path: 'electronic-documents', canActivate: [roleGuard], data: { roles: ['ADMIN', 'SELLER', 'MANAGEMENT'] }, loadComponent: () => import('./features/electronic-documents/electronic-documents.page').then(m => m.ElectronicDocumentsPage) },
    { path: 'users', canActivate: [roleGuard], data: { roles: ['ADMIN'] }, loadComponent: () => import('./features/users/users.page').then(m => m.UsersPage) },
    { path: 'settings', canActivate: [roleGuard], data: { roles: ['ADMIN', 'MANAGEMENT'] }, loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPage) },
    { path: 'payment-methods', canActivate: [roleGuard], data: { roles: ['ADMIN'] }, loadComponent: () => import('./features/payment-methods/payment-methods.page').then(m => m.PaymentMethodsPage) },
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  ]},
  { path: '**', redirectTo: 'dashboard' },
];
