import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { ApiRequestError } from '../errors/api-request.error';
import { ApiClient } from '../http/api-client.service';
import { UserRole } from '../models/navigation.model';

interface BackendSessionUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role?: UserRole;
  roles?: UserRole[];
  activeRole?: UserRole;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  roles: UserRole[];
  mustChangePassword: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly session = signal<AuthSession | null>(null);
  private initialized = false;
  private initializationRequest: Observable<AuthSession | null> | null = null;

  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly userId = computed(() => this.session()?.id ?? '');
  readonly role = computed(() => this.session()?.role ?? 'ADMIN');
  readonly roles = computed(() => this.session()?.roles ?? []);
  readonly userName = computed(() => this.session()?.fullName ?? '');
  readonly mustChangePassword = computed(() => this.session()?.mustChangePassword ?? false);

  /**
   * Recupera la sesión desde la cookie HttpOnly una sola vez por carga.
   * Los guards llaman este método antes de decidir a qué ruta navegar.
   */
  ensureSession(): Observable<AuthSession | null> {
    if (this.initialized) {
      return of(this.session());
    }

    if (this.initializationRequest) {
      return this.initializationRequest;
    }

    this.initializationRequest = this.api.get<BackendSessionUser>('auth/me').pipe(
      map(user => toSession(user, storedRoles())),
      tap(session => this.session.set(session)),
      catchError((error: unknown) => {
        if (error instanceof ApiRequestError && error.status === 401) {
          this.session.set(null);
          return of(null);
        }
        return throwError(() => error);
      }),
      finalize(() => {
        this.initialized = true;
        this.initializationRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.initializationRequest;
  }

  login(identifier: string, password: string): Observable<AuthSession> {
    return this.api.post<BackendSessionUser, { identifier: string; password: string }>(
      'auth/login',
      { identifier: identifier.trim(), password },
    ).pipe(
      map(user => toSession(user)),
      tap(session => {
        this.session.set(session);
        storeRoles(session.roles);
        this.initialized = true;
      }),
    );
  }

  switchRole(role: UserRole): Observable<AuthSession> {
    return this.api.post<BackendSessionUser, { role: UserRole }>('auth/switch-role', { role }).pipe(
      map(user => toSession(user, this.roles())),
      tap(session => {
        this.session.set(session);
        storeRoles(session.roles);
      }),
    );
  }

  logout(): Observable<void> {
    return this.api.post<void, Record<string, never>>('auth/logout', {}).pipe(
      finalize(() => this.clearSession()),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.api.post<void, { currentPassword: string; newPassword: string }>(
      'auth/change-password',
      { currentPassword, newPassword },
    ).pipe(
      tap(() => {
        const current = this.session();
        if (current) {
          this.session.set({ ...current, mustChangePassword: false });
        }
      }),
    );
  }

  /** Limpieza local para respuestas 401; no realiza otra petición HTTP. */
  clearSession(): void {
    this.session.set(null);
    clearStoredRoles();
    this.initialized = true;
  }
}

function toSession(user: BackendSessionUser, fallbackRoles: UserRole[] = []): AuthSession {
  const activeRole = user.activeRole ?? user.role;
  if (!activeRole) {
    throw new Error('La sesión no incluye un rol activo.');
  }
  const roles = uniqueRoles(user.roles?.length ? user.roles : fallbackRoles.length ? fallbackRoles : [activeRole]);
  if (!roles.includes(activeRole)) roles.push(activeRole);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    role: activeRole,
    roles,
    mustChangePassword: user.mustChangePassword,
  };
}

const SESSION_ROLES_KEY = 'demosystem.session.roles';

function storedRoles(): UserRole[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_ROLES_KEY) ?? '[]');
    return Array.isArray(value) ? uniqueRoles(value) : [];
  } catch {
    return [];
  }
}

function storeRoles(roles: UserRole[]): void {
  try { sessionStorage.setItem(SESSION_ROLES_KEY, JSON.stringify(uniqueRoles(roles))); } catch { /* almacenamiento opcional */ }
}

function clearStoredRoles(): void {
  try { sessionStorage.removeItem(SESSION_ROLES_KEY); } catch { /* almacenamiento opcional */ }
}

function uniqueRoles(values: unknown[]): UserRole[] {
  const valid: UserRole[] = ['ADMIN', 'SELLER', 'WAREHOUSE', 'MANAGEMENT'];
  return [...new Set(values.filter((value): value is UserRole => valid.includes(value as UserRole)))];
}
