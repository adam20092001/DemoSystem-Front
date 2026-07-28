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

interface BackendUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: UserRole;
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

    this.initializationRequest = this.api.get<BackendUser>('auth/me').pipe(
      map(user => toSession(user)),
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
    return this.api.post<BackendUser, { identifier: string; password: string }>(
      'auth/login',
      { identifier: identifier.trim(), password },
    ).pipe(
      map(user => toSession(user)),
      tap(session => {
        this.session.set(session);
        this.initialized = true;
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
    this.initialized = true;
  }
}

function toSession(user: BackendUser): AuthSession {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}
