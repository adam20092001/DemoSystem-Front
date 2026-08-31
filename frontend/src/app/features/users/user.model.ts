import { UserRole } from '../../core/models/navigation.model';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  roles: UserRole[];
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListUsersQuery {
  page: number;
  limit: number;
  search?: string;
  status?: UserStatus;
  roleName?: UserRole;
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  temporaryPassword: string;
  roleNames: UserRole[];
}

export interface UpdateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  roleNames: UserRole[];
}

export interface ResetPasswordResponse {
  user: User;
  temporaryPassword: string;
}
