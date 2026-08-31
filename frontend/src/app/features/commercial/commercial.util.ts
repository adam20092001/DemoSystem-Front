import { ApiRequestError } from '../../core/errors/api-request.error';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { PaymentMethod } from './commercial.model';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'CASH',
  'BANK_TRANSFER',
  'BANK_DEPOSIT',
  'CARD',
  'DIGITAL_WALLET',
  'OTHER',
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  BANK_TRANSFER: 'Transferencia bancaria',
  BANK_DEPOSIT: 'Depósito bancario',
  CARD: 'Tarjeta',
  DIGITAL_WALLET: 'Billetera digital',
  OTHER: 'Otro',
};

export function requestErrorMessage(error: unknown): string {
  return error instanceof ApiRequestError
    ? error.message
    : 'No se pudo completar la operación. Inténtalo nuevamente.';
}

export function money(value: string | number | null | undefined, currency = 'PEN'): string {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(safeAmount);
  } catch {
    return `${currency} ${safeAmount.toFixed(2)}`;
  }
}

export function shortDate(value: string): string {
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(dateValue(value));
}

export function dateTime(value: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(dateValue(value));
}

export function pageRange(result: PaginatedResponse<unknown> | null): string {
  if (!result || result.total === 0) return '0 resultados';
  const from = (result.page - 1) * result.limit + 1;
  const to = Math.min(result.page * result.limit, result.total);
  return `${from}–${to} de ${result.total}`;
}

export function requiresPaymentReference(method: PaymentMethod): boolean {
  return ['BANK_TRANSFER', 'BANK_DEPOSIT', 'CARD'].includes(method);
}

export function validAmount(value: string, allowZero = false): boolean {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value.trim())) return false;
  return allowZero ? Number(value) >= 0 : Number(value) > 0;
}

export function validQuantity(value: string): boolean {
  return /^\d{1,11}(\.\d{1,3})?$/.test(value.trim()) && Number(value) > 0;
}

function dateValue(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
}
