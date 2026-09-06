export type PaymentMethodAccountingDestination = 'CASH' | 'BANK';

export interface PaymentMethodDefinition {
  id: string;
  code: string;
  name: string;
  active: boolean;
  requiresReference: boolean;
  affectsCashDrawer: boolean;
  accountingDestination: PaymentMethodAccountingDestination;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentMethodRequest {
  code: string;
  name: string;
  requiresReference: boolean;
  affectsCashDrawer: boolean;
  accountingDestination: PaymentMethodAccountingDestination;
  sortOrder?: number;
}

export type UpdatePaymentMethodRequest = Partial<
  Omit<CreatePaymentMethodRequest, 'code'> & { active: boolean }
>;
