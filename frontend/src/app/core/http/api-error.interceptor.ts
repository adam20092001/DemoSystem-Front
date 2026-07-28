import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ApiRequestError } from '../errors/api-request.error';
import { AuthService } from '../auth/auth.service';

interface ErrorPayload {
  statusCode?: unknown;
  message?: unknown;
  error?: unknown;
  timestamp?: unknown;
  path?: unknown;
}

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      const isCredentialCheck =
        request.url.endsWith('/auth/login') ||
        request.url.endsWith('/auth/change-password');

      if (error.status === 401 && auth.isAuthenticated() && !isCredentialCheck) {
        auth.clearSession();
        router.navigateByUrl('/login');
      }

      const payload = isErrorPayload(error.error) ? error.error : {};
      const message = normalizeMessage(payload.message) ?? defaultMessage(error.status);

      return throwError(() => new ApiRequestError(
        error.status,
        typeof payload.error === 'string'
          ? payload.error
          : `HTTP_${error.status || 'NETWORK'}`,
        message,
        typeof payload.path === 'string' ? { path: payload.path } : undefined,
      ));
    }),
  );
};

function isErrorPayload(value: unknown): value is ErrorPayload {
  return isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeMessage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    return value.join(' ');
  }
  return null;
}

function defaultMessage(status: number): string {
  if (status === 0) return 'No se pudo conectar con el servidor.';
  if (status === 401) return 'La sesión ha expirado o no es válida.';
  if (status === 403) return 'No tienes permisos para realizar esta acción.';
  if (status === 404) return 'No se encontró el recurso solicitado.';
  return 'Ocurrió un error inesperado. Inténtalo nuevamente.';
}
