export type UserRole = 'ADMIN' | 'SELLER' | 'WAREHOUSE' | 'MANAGEMENT' | 'ACCOUNTANT';
export interface NavigationItem { label: string; route: string; icon: string; roles: UserRole[]; feature?: 'sire-demo'; }
