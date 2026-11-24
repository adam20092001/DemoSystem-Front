export function displayDate(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso ?? '';
}
export function maskDateInput(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return displayDate(value);
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}
export function parseDisplayDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}
export function dateInputError(value: string, min = '', max = ''): string {
  if (!value) return '';
  const iso = parseDisplayDate(value);
  if (!iso) return 'Ingresa una fecha válida en DD/MM/AAAA.';
  if (min && iso < min) return `La fecha debe ser igual o posterior a ${displayDate(min)}.`;
  if (max && iso > max) return `La fecha debe ser igual o anterior a ${displayDate(max)}.`;
  return '';
}

/** Parse display-only separators without floating point rounding or precision loss. */
export function parseMoneyInput(value: string | number, decimals = 2): string | null {
  let text = String(value).trim().replace(/^(?:S\s*\/|[A-Z]{3}|[$€£¥₹])\s*(?=\d)/i, '').replace(/[\s\u00a0]/g, '');
  if (!text) return '';
  if (text.includes(',')) {
    if (/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(text)) text = text.replace(/,/g, '');
    else if (/^\d+,\d{1,2}$/.test(text)) text = text.replace(',', '.');
    else return null;
  }
  if (!/^\d+(\.\d*)?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimals) return null;
  return `${whole.replace(/^0+(?=\d)/, '')}${fraction ? '.' + fraction : ''}`;
}
export function formatMoneyInput(value: string | number, decimals = 2): string {
  const parsed = parseMoneyInput(value, decimals);
  if (parsed === '' || parsed === null) return parsed === null ? String(value) : '';
  const [whole, fraction = ''] = parsed.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.replace(/0+$/, '').padEnd(2, '0')}`;
}
