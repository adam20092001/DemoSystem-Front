import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiRequestError } from '../../core/errors/api-request.error';

@Component({
  selector: 'app-login',
  template: `
    <main class="login">
      <section class="promo">
        <a class="brand" href="#">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
              <path d="M4 20V9l8-5 8 5v11" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              <path d="M9 20v-6h6v6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            </svg>
          </span>
          <span>IMDIMAQ</span>
        </a>
        <div class="promo-body">
          <p class="promo-kicker">Sistema interno de gestión comercial</p>
          <h1>Control operativo para venta e inventario técnico.</h1>
          <p class="lead">Catálogo técnico, cotizaciones, ventas e inventario trazable en una sola plataforma interna.</p>
        </div>
        <ul class="module-list">
          <li>Catálogo y productos</li>
          <li>Inventario y movimientos</li>
          <li>Cotizaciones y ventas</li>
          <li>Pagos y cuentas por cobrar</li>
          <li>Reportes gerenciales</li>
        </ul>
      </section>

      <section class="access">
        <form (submit)="onSubmit($event, usernameInput.value, passwordInput.value)">
          <p class="eyebrow">Acceso interno</p>
          <h2>Ingresa a tu cuenta</h2>
          <p class="sub">Usa tus credenciales corporativas para continuar.</p>

          @if (error()) {
            <p class="error-banner" role="alert">{{ error() }}</p>
          }

          <label class="field">
            <span>Usuario o correo</span>
            <input #usernameInput class="input" autocomplete="username" [disabled]="loading()" autofocus>
          </label>
          <label class="field">
            <span>Contraseña</span>
            <input #passwordInput class="input" type="password" autocomplete="current-password" [disabled]="loading()">
          </label>

          <button class="btn btn--primary submit" type="submit" [disabled]="loading()">
            @if (loading()) {
              Ingresando…
            } @else {
              Ingresar al sistema
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            }
          </button>

          <p class="hint">La sesión se protege mediante una cookie segura administrada por el servidor.</p>
        </form>
      </section>
    </main>
  `,
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected onSubmit(event: Event, username: string, password: string): void {
    event.preventDefault();
    this.error.set(null);

    if (!username.trim() || !password) {
      this.error.set('Ingresa tu usuario y tu contraseña.');
      return;
    }

    this.loading.set(true);
    this.auth.login(username, password).pipe(
      take(1),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: session => {
        this.router.navigateByUrl(
          session.mustChangePassword ? '/change-password' : '/dashboard',
        );
      },
      error: (error: unknown) => {
        this.error.set(
          error instanceof ApiRequestError
            ? error.message
            : 'No se pudo iniciar sesión. Inténtalo nuevamente.',
        );
      },
    });
  }
}
