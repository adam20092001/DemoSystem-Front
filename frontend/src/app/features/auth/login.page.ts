import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiRequestError } from '../../core/errors/api-request.error';

@Component({
  selector: 'app-login',
  template: `
    <main class="login">
      <section class="access">
        <form aria-label="Iniciar sesión" (submit)="onSubmit($event, usernameInput.value, passwordInput.value)">

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
  protected readonly error = visibleErrorSignal();

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
          session.mustChangePassword ? '/change-password' : session.role === 'ACCOUNTANT' ? '/accounting' : session.role === 'PURCHASING' ? '/purchases' : session.role === 'WAREHOUSE' ? '/purchase-receiving' : '/dashboard',
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
