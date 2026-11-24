export type UserRole = 'ADMIN' | 'SELLER' | 'WAREHOUSE' | 'MANAGEMENT' | 'ACCOUNTANT' | 'PURCHASING';
export interface NavigationItem { label: string; route: string; icon: string; roles: UserRole[]; feature?: 'sire-demo'; }
