import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiRequestError } from '../../core/errors/api-request.error';

@Component({
  selector: 'app-change-password',
  template: `
    <main class="password-page">
      <section class="password-card surface">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <path d="M4 20V9l8-5 8 5v11" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M9 20v-6h6v6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          </svg>
        </span>

        <p class="eyebrow">Seguridad de la cuenta</p>
        <h1>Crea una nueva contraseña</h1>
        <p class="sub">
          Por seguridad debes reemplazar la contraseña temporal antes de ingresar al sistema.
        </p>

        @if (error()) {
          <p class="error-banner" role="alert">{{ error() }}</p>
        }

        <form (submit)="onSubmit(
          $event,
          currentPassword.value,
          newPassword.value,
          confirmation.value
        )">
          <label class="field">
            <span>Contraseña actual</span>
            <input #currentPassword class="input" type="password" autocomplete="current-password" [disabled]="loading()" autofocus>
          </label>

          <label class="field">
            <span>Nueva contraseña</span>
            <input #newPassword class="input" type="password" autocomplete="new-password" [disabled]="loading()">
          </label>

          <label class="field">
            <span>Confirma la nueva contraseña</span>
            <input #confirmation class="input" type="password" autocomplete="new-password" [disabled]="loading()">
          </label>

          <p class="requirements">Mínimo 12 caracteres, con al menos una letra y un número.</p>

          <button class="btn btn--primary submit" type="submit" [disabled]="loading()">
            @if (loading()) { Guardando… } @else { Guardar y continuar }
          </button>
          <button class="btn btn--quiet logout" type="button" [disabled]="loading()" (click)="logout()">
            Cerrar sesión
          </button>
        </form>
      </section>
    </main>
  `,
  styleUrl: './change-password.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected onSubmit(
    event: Event,
    currentPassword: string,
    newPassword: string,
    confirmation: string,
  ): void {
    event.preventDefault();
    this.error.set(null);

    if (!currentPassword || !newPassword || !confirmation) {
      this.error.set('Completa todos los campos.');
      return;
    }
    if (newPassword !== confirmation) {
      this.error.set('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    if (newPassword.length < 12 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      this.error.set('La nueva contraseña no cumple los requisitos indicados.');
      return;
    }

    this.loading.set(true);
    this.auth.changePassword(currentPassword, newPassword).pipe(
      take(1),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (error: unknown) => {
        this.error.set(
          error instanceof ApiRequestError
            ? error.message
            : 'No se pudo cambiar la contraseña. Inténtalo nuevamente.',
        );
      },
    });
  }

  protected logout(): void {
    this.loading.set(true);
    this.auth.logout().pipe(
      take(1),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login'),
    });
  }
}
