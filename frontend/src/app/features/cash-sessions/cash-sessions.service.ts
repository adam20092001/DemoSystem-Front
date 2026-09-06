import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap, throwError } from 'rxjs';
import { ApiRequestError } from '../../core/errors/api-request.error';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { CashSession, CashSessionDetail, ListCashSessionsQuery } from './cash-session.model';

@Injectable({ providedIn: 'root' })
export class CashSessionsService {
  private readonly api = inject(ApiClient);
  readonly current = signal<CashSessionDetail | null>(null);
  readonly hasOpenSession = computed(() => this.current()?.status === 'OPEN');

  refreshCurrent(): Observable<CashSessionDetail | null> {
    return this.api.get<CashSessionDetail>('cash-sessions/current').pipe(
      tap(session => this.current.set(session)),
      catchError((error: unknown) => {
        if (error instanceof ApiRequestError && error.status === 404) {
          this.current.set(null);
          return of(null);
        }
        return throwError(() => error);
      }),
    );
  }

  open(openingAmount: string): Observable<CashSession> {
    return this.api.post<CashSession, { openingAmount: string }>('cash-sessions/open', { openingAmount });
  }

  close(countedCashAmount: string, closingObservation?: string): Observable<CashSession> {
    return this.api.post<CashSession, { countedCashAmount: string; closingObservation?: string }>(
      'cash-sessions/current/close',
      { countedCashAmount, ...(closingObservation ? { closingObservation } : {}) },
    );
  }

  list(query: ListCashSessionsQuery): Observable<PaginatedResponse<CashSession>> {
    return this.api.get<PaginatedResponse<CashSession>>(
      'cash-sessions',
      Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== '')) as QueryParams,
    );
  }

  getDetail(id: string): Observable<CashSessionDetail> {
    return this.api.get<CashSessionDetail>(`cash-sessions/${id}`);
  }

  approve(id: string, comment?: string): Observable<CashSession> {
    return this.api.post<CashSession, { comment?: string }>(
      `cash-sessions/${id}/approve`,
      comment ? { comment } : {},
    );
  }

  reject(id: string, reason: string): Observable<CashSession> {
    return this.api.post<CashSession, { reason: string }>(`cash-sessions/${id}/reject`, { reason });
  }
}
