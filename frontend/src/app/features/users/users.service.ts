import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import {
  CreateUserRequest,
  ListUsersQuery,
  ResetPasswordResponse,
  UpdateUserRequest,
  User,
} from './user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiClient);

  list(query: ListUsersQuery): Observable<PaginatedResponse<User>> {
    const params: QueryParams = {
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      roleName: query.roleName,
    };
    return this.api.get<PaginatedResponse<User>>('users', params);
  }

  create(request: CreateUserRequest): Observable<User> {
    return this.api.post<User, CreateUserRequest>('users', request);
  }

  update(id: string, request: UpdateUserRequest): Observable<User> {
    return this.api.patch<User, UpdateUserRequest>(`users/${id}`, request);
  }

  block(id: string): Observable<User> {
    return this.api.post<User, Record<string, never>>(`users/${id}/block`, {});
  }

  unblock(id: string): Observable<User> {
    return this.api.post<User, Record<string, never>>(`users/${id}/unblock`, {});
  }

  resetPassword(id: string): Observable<ResetPasswordResponse> {
    return this.api.post<ResetPasswordResponse, Record<string, never>>(
      `users/${id}/reset-password`,
      {},
    );
  }
}
