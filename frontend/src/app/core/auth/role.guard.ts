import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserRole } from '../models/navigation.model';

/**
 * Restringe una ruta hija del shell a los roles declarados en `data.roles`.
 * El backend seguirá siendo la autoridad real (ocultar rutas no es seguridad);
 * este guard solo evita que un usuario navegue a una pantalla fuera de su rol.
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = route.data['roles'] as UserRole[] | undefined;

  if (!allowedRoles || allowedRoles.includes(auth.role())) return true;
  return router.createUrlTree(['/dashboard']);
};
