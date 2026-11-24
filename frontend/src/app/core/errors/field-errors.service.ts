import { Injectable, signal } from '@angular/core';
export interface ApiFieldError { field: string; code: string; type: 'REQUIRED' | 'FORMAT' | 'BUSINESS'; message: string }
@Injectable({ providedIn: 'root' })
export class FieldErrorsService {
  readonly errors = signal<ApiFieldError[]>([]);
  publish(errors: ApiFieldError[]): void { this.errors.set([...errors]); }
}
