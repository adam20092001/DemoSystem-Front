export type UserRole = 'ADMIN' | 'SELLER' | 'WAREHOUSE' | 'MANAGEMENT';
export interface NavigationItem { label: string; route: string; icon: string; roles: UserRole[]; }
