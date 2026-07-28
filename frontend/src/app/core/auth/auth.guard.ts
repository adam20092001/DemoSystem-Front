import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

/** Restaura la sesión y bloquea rutas privadas cuando la cookie no es válida. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureSession().pipe(
    map(session => session !== null || router.createUrlTree(['/login'])),
  );
};

/** Evita mostrar el login a una sesión ya autenticada. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureSession().pipe(
    map(session => {
      if (!session) return true;
      return router.createUrlTree([
        session.mustChangePassword ? '/change-password' : '/dashboard',
      ]);
    }),
  );
};

/** Impide entrar al sistema hasta completar el cambio obligatorio inicial. */
export const passwordChangeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureSession().pipe(
    map(session => {
      if (!session) return router.createUrlTree(['/login']);
      return !session.mustChangePassword || router.createUrlTree(['/change-password']);
    }),
  );
};

/** Solo permite abrir la pantalla de cambio cuando la cuenta lo requiere. */
export const requiredPasswordChangeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureSession().pipe(
    map(session => {
      if (!session) return router.createUrlTree(['/login']);
      return session.mustChangePassword || router.createUrlTree(['/dashboard']);
    }),
  );
};
