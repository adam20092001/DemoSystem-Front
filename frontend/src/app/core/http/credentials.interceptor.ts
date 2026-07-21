import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { API_CONFIG } from '../config/api.config';

export const credentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(API_CONFIG);

  if (!request.url.startsWith(config.baseUrl)) {
    return next(request);
  }

  return next(request.clone({ withCredentials: config.withCredentials }));
};
