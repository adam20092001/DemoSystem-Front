import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { DashboardQuery, DashboardResponse } from './dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiClient);

  getDashboard(query: DashboardQuery = {}): Observable<DashboardResponse> {
    return this.api.get<DashboardResponse>('dashboard', query as QueryParams);
  }
}
