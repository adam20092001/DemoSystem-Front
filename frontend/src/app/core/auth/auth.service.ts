import { Injectable, computed, signal } from '@angular/core';
import { UserRole } from '../models/navigation.model';

export interface AuthSession {
  username: string;
  fullName: string;
  role: UserRole;
  mustChangePassword: boolean;
}

/**
 * Sesión simulada en frontend mientras el backend no está disponible
 * (ver docs/architecture.md). El backend real reemplazará login/logout
 * por llamadas HTTP contra /auth y la sesión llegará por cookie HttpOnly;
 * la superficie pública de este servicio (signals + login/logout) no cambia.
 */
const DEMO_USER: AuthSession = {
  username: 'admin',
  fullName: 'Mariana Torres',
  role: 'ADMIN',
  mustChangePassword: false,
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session = signal<AuthSession | null>(null);

  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly role = computed(() => this.session()?.role ?? 'ADMIN');
  readonly userName = computed(() => this.session()?.fullName ?? '');
  readonly mustChangePassword = computed(() => this.session()?.mustChangePassword ?? false);

  login(username: string, password: string): boolean {
    if (!username.trim() || !password.trim()) return false;
    this.session.set({ ...DEMO_USER, username: username.trim() });
    return true;
  }

  logout(): void {
    this.session.set(null);
  }

  /** Alterna el rol solo para recorrer la demo entre vistas; no representa un cambio de permisos real. */
  setRole(role: UserRole): void {
    const current = this.session();
    if (current) this.session.set({ ...current, role });
  }
}
