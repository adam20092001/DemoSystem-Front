import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import {
  AccountingAccount,
  AccountingEntryDetail,
  AccountingEntryListItem,
  ListAccountingEntriesQuery,
} from './accounting.model';

@Injectable({ providedIn: 'root' })
export class AccountingService {
  private readonly api = inject(ApiClient);

  listAccounts(): Observable<AccountingAccount[]> {
    return this.api.get<AccountingAccount[]>('accounts');
  }

  listEntries(
    query: ListAccountingEntriesQuery,
  ): Observable<PaginatedResponse<AccountingEntryListItem>> {
    return this.api.get<PaginatedResponse<AccountingEntryListItem>>(
      'accounting/entries',
      queryParams(query),
    );
  }

  getEntry(id: string): Observable<AccountingEntryDetail> {
    return this.api.get<AccountingEntryDetail>(`accounting/entries/${id}`);
  }
}

function queryParams(query: object): QueryParams {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ) as QueryParams;
}
