import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, Observable, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiRequestError } from '../../core/errors/api-request.error';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { UserRole } from '../../core/models/navigation.model';
import {
  CreateUserRequest,
  ResetPasswordResponse,
  UpdateUserRequest,
  User,
  UserStatus,
} from './user.model';
import { UsersService } from './users.service';

type FormMode = 'create' | 'edit';
type ConfirmActionKind = 'block' | 'unblock' | 'reset';

interface UserForm {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  temporaryPassword: string;
  roleNames: UserRole[];
}

interface ConfirmAction {
  kind: ConfirmActionKind;
  user: User;
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  SELLER: 'Vendedor',
  WAREHOUSE: 'Almacén',
  MANAGEMENT: 'Gerencia',
};

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  BLOCKED: 'Bloqueado',
};

@Component({
  selector: 'app-users',
  imports: [DatePipe, FormsModule],
  templateUrl: './users.page.html',
  styleUrl: './users.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly usersService = inject(UsersService);

  protected readonly roles: UserRole[] = ['ADMIN', 'SELLER', 'WAREHOUSE', 'MANAGEMENT'];
  protected readonly statuses: UserStatus[] = ['ACTIVE', 'INACTIVE', 'BLOCKED'];
  protected readonly pageSizes = [10, 20, 50];

  protected searchTerm = '';
  protected selectedStatus = '';
  protected selectedRole = '';
  protected pageSize = 20;

  protected readonly result = signal<PaginatedResponse<User> | null>(null);
  protected readonly loading = signal(false);
  protected readonly actionLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly formMode = signal<FormMode | null>(null);
  protected readonly editingUser = signal<User | null>(null);
  protected readonly confirmAction = signal<ConfirmAction | null>(null);
  protected readonly resetResult = signal<ResetPasswordResponse | null>(null);
  protected readonly copied = signal(false);

  protected userForm: UserForm = emptyForm();

  protected readonly firstRecord = computed(() => {
    const value = this.result();
    if (!value || value.total === 0) return 0;
    return (value.page - 1) * value.limit + 1;
  });

  protected readonly lastRecord = computed(() => {
    const value = this.result();
    if (!value) return 0;
    return Math.min(value.page * value.limit, value.total);
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  protected applyFilters(event: Event): void {
    event.preventDefault();
    this.loadUsers(1);
  }

  protected clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedRole = '';
    this.loadUsers(1);
  }

  protected changePageSize(value: number): void {
    this.pageSize = value;
    this.loadUsers(1);
  }

  protected previousPage(): void {
    const page = this.result()?.page ?? 1;
    if (page > 1) this.loadUsers(page - 1);
  }

  protected nextPage(): void {
    const value = this.result();
    if (value && value.page < value.totalPages) this.loadUsers(value.page + 1);
  }

  protected openCreate(): void {
    this.error.set(null);
    this.userForm = emptyForm();
    this.editingUser.set(null);
    this.formMode.set('create');
  }

  protected openEdit(user: User): void {
    this.error.set(null);
    this.userForm = {
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      temporaryPassword: '',
      roleNames: [...user.roles],
    };
    this.editingUser.set(user);
    this.formMode.set('edit');
  }

  protected closeForm(): void {
    if (this.actionLoading()) return;
    this.formMode.set(null);
    this.editingUser.set(null);
    this.error.set(null);
  }

  protected submitUser(event: Event): void {
    event.preventDefault();
    const validationMessage = validateForm(this.userForm, this.formMode());
    if (validationMessage) {
      this.error.set(validationMessage);
      return;
    }

    const mode = this.formMode();
    const editing = this.editingUser();
    let request$: Observable<User>;

    if (mode === 'create') {
      const request: CreateUserRequest = {
        firstName: this.userForm.firstName.trim(),
        lastName: this.userForm.lastName.trim(),
        username: this.userForm.username.trim(),
        email: this.userForm.email.trim(),
        temporaryPassword: this.userForm.temporaryPassword,
        roleNames: this.userForm.roleNames,
      };
      request$ = this.usersService.create(request);
    } else if (mode === 'edit' && editing) {
      const request: UpdateUserRequest = {
        firstName: this.userForm.firstName.trim(),
        lastName: this.userForm.lastName.trim(),
        email: this.userForm.email.trim(),
        roleNames: this.userForm.roleNames,
      };
      request$ = this.usersService.update(editing.id, request);
    } else {
      return;
    }

    this.error.set(null);
    this.actionLoading.set(true);
    request$.pipe(
      take(1),
      finalize(() => this.actionLoading.set(false)),
    ).subscribe({
      next: user => {
        this.formMode.set(null);
        this.editingUser.set(null);
        this.notice.set(
          mode === 'create'
            ? `Usuario ${user.username} creado correctamente.`
            : `Usuario ${user.username} actualizado correctamente.`,
        );
        this.loadUsers(mode === 'create' ? 1 : (this.result()?.page ?? 1));
      },
      error: (error: unknown) => this.error.set(errorMessage(error)),
    });
  }

  protected askAction(kind: ConfirmActionKind, user: User): void {
    this.error.set(null);
    this.confirmAction.set({ kind, user });
  }

  protected closeConfirmation(): void {
    if (!this.actionLoading()) this.confirmAction.set(null);
  }

  protected runConfirmedAction(): void {
    const action = this.confirmAction();
    if (!action) return;

    let request$: Observable<User | ResetPasswordResponse>;
    if (action.kind === 'block') {
      request$ = this.usersService.block(action.user.id);
    } else if (action.kind === 'unblock') {
      request$ = this.usersService.unblock(action.user.id);
    } else {
      request$ = this.usersService.resetPassword(action.user.id);
    }

    this.actionLoading.set(true);
    this.error.set(null);
    request$.pipe(
      take(1),
      finalize(() => this.actionLoading.set(false)),
    ).subscribe({
      next: response => {
        this.confirmAction.set(null);
        if (action.kind === 'reset' && isResetResponse(response)) {
          this.resetResult.set(response);
          this.copied.set(false);
        } else {
          this.notice.set(
            action.kind === 'block'
              ? `Usuario ${action.user.username} bloqueado.`
              : `Usuario ${action.user.username} desbloqueado.`,
          );
        }
        this.loadUsers(this.result()?.page ?? 1);
      },
      error: (error: unknown) => {
        this.confirmAction.set(null);
        this.error.set(errorMessage(error));
      },
    });
  }

  protected closeResetResult(): void {
    this.resetResult.set(null);
    this.copied.set(false);
  }

  protected async copyTemporaryPassword(): Promise<void> {
    const password = this.resetResult()?.temporaryPassword;
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  protected roleLabel(role: UserRole): string {
    return ROLE_LABELS[role];
  }

  protected toggleRole(role: UserRole, checked: boolean): void {
    this.userForm.roleNames = checked
      ? [...new Set([...this.userForm.roleNames, role])]
      : this.userForm.roleNames.filter(item => item !== role);
  }

  protected hasRole(role: UserRole): boolean {
    return this.userForm.roleNames.includes(role);
  }

  protected statusLabel(status: UserStatus): string {
    return STATUS_LABELS[status];
  }

  protected statusClass(status: UserStatus): string {
    if (status === 'ACTIVE') return 'badge--ok';
    if (status === 'BLOCKED') return 'badge--danger';
    return 'badge--neutral';
  }

  protected confirmTitle(action: ConfirmAction): string {
    if (action.kind === 'block') return 'Bloquear usuario';
    if (action.kind === 'unblock') return 'Desbloquear usuario';
    return 'Restablecer contraseña';
  }

  protected confirmDescription(action: ConfirmAction): string {
    if (action.kind === 'block') {
      return `${action.user.firstName} ${action.user.lastName} perderá el acceso al sistema.`;
    }
    if (action.kind === 'unblock') {
      return `${action.user.firstName} ${action.user.lastName} podrá volver a iniciar sesión.`;
    }
    return `Se invalidará la contraseña actual de ${action.user.username} y se generará una temporal.`;
  }

  private loadUsers(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.usersService.list({
      page,
      limit: this.pageSize,
      ...(this.searchTerm.trim() ? { search: this.searchTerm.trim() } : {}),
      ...(this.selectedStatus ? { status: this.selectedStatus as UserStatus } : {}),
      ...(this.selectedRole ? { roleName: this.selectedRole as UserRole } : {}),
    }).pipe(
      take(1),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: result => this.result.set(result),
      error: (error: unknown) => this.error.set(errorMessage(error)),
    });
  }
}

function emptyForm(): UserForm {
  return {
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    temporaryPassword: '',
    roleNames: ['SELLER'],
  };
}

function validateForm(form: UserForm, mode: FormMode | null): string | null {
  if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
    return 'Completa nombre, apellido y correo.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return 'Ingresa un correo válido.';
  }
  if (!form.roleNames.length) return 'Selecciona al menos un rol.';
  if (mode === 'create') {
    if (form.username.trim().length < 3) {
      return 'El usuario debe tener al menos 3 caracteres.';
    }
    const password = form.temporaryPassword;
    if (password.length < 12 || password.length > 128 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return 'La contraseña temporal debe tener entre 12 y 128 caracteres, al menos una letra y un número.';
    }
  }
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiRequestError
    ? error.message
    : 'No se pudo completar la operación. Inténtalo nuevamente.';
}

function isResetResponse(value: User | ResetPasswordResponse): value is ResetPasswordResponse {
  return 'temporaryPassword' in value;
}
