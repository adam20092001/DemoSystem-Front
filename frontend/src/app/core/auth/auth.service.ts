import { Injectable, signal } from '@angular/core';
import { UserRole } from '../models/navigation.model';
@Injectable({ providedIn: 'root' })
export class AuthService { readonly role = signal<UserRole>('ADMIN'); readonly userName = signal('Mariana Torres'); setRole(role: UserRole): void { this.role.set(role); } }
