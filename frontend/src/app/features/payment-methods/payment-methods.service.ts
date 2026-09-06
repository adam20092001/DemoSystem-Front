import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import {
  CreatePaymentMethodRequest,
  PaymentMethodDefinition,
  UpdatePaymentMethodRequest,
} from './payment-method.model';

@Injectable({ providedIn: 'root' })
export class PaymentMethodsService {
  private readonly api = inject(ApiClient);
  readonly activeMethods = signal<PaymentMethodDefinition[]>([]);

  listActive(): Observable<PaymentMethodDefinition[]> {
    return this.api.get<PaymentMethodDefinition[]>('payment-methods').pipe(
      tap(methods => this.activeMethods.set(methods)),
    );
  }

  listAll(): Observable<PaymentMethodDefinition[]> {
    return this.api.get<PaymentMethodDefinition[]>('payment-methods', { includeInactive: true });
  }

  create(request: CreatePaymentMethodRequest): Observable<PaymentMethodDefinition> {
    return this.api.post<PaymentMethodDefinition, CreatePaymentMethodRequest>('payment-methods', request);
  }

  update(id: string, request: UpdatePaymentMethodRequest): Observable<PaymentMethodDefinition> {
    return this.api.patch<PaymentMethodDefinition, UpdatePaymentMethodRequest>(`payment-methods/${id}`, request);
  }

  find(code: string): PaymentMethodDefinition | undefined {
    return this.activeMethods().find(method => method.code === code);
  }
}
