import { ApiRequestError } from '../../core/errors/api-request.error';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { PaymentMethod } from './commercial.model';
import { PaymentMethodDefinition } from '../payment-methods/payment-method.model';

export function requestErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.details?.['kind'] === 'FORM') return 'Revisa los campos marcados para continuar.';
  return error instanceof ApiRequestError
    ? error.message
    : 'No se pudo completar la operación. Inténtalo nuevamente.';
}

export function money(value: string | number | null | undefined, currency = 'PEN'): string {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeAmount);
  } catch {
    return `${currency} ${safeAmount.toFixed(2)}`;
  }
}

export function quantity(value: string | number, allowDecimal = true): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: allowDecimal ? 0 : 0,
    maximumFractionDigits: allowDecimal ? 3 : 0,
  }).format(amount);
}

export function shortDate(value: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = dateParts(date);
  return `${parts['day']}/${parts['month']}/${parts['year']}`;
}

export function dateTime(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return shortDate(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = dateParts(date, true);
  return `${parts['day']}/${parts['month']}/${parts['year']} ${parts['hour']}:${parts['minute']}`;
}

export function pageRange(result: PaginatedResponse<unknown> | null): string {
  if (!result || result.total === 0) return '0 resultados';
  const from = (result.page - 1) * result.limit + 1;
  const to = Math.min(result.page * result.limit, result.total);
  return `${from}–${to} de ${result.total}`;
}

export function requiresPaymentReference(methods: readonly PaymentMethodDefinition[], code: PaymentMethod): boolean {
  return methods.find(method => method.code === code)?.requiresReference ?? false;
}

export function validAmount(value: string, allowZero = false): boolean {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value.trim())) return false;
  return allowZero ? Number(value) >= 0 : Number(value) > 0;
}

export function validQuantity(value: string): boolean {
  return /^\d{1,11}(\.\d{1,3})?$/.test(value.trim()) && Number(value) > 0;
}

function dateParts(date: Date, includeTime = false): Record<string, string> {
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  };
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', options).formatToParts(date).map(part => [part.type, part.value]),
  );
}
