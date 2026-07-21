import { InjectionToken } from '@angular/core';

export interface ApiConfig {
  baseUrl: string;
  withCredentials: boolean;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');
