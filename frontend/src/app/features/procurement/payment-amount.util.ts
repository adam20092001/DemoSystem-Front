/** Aritmética decimal exacta para importes enviados al servidor. */
export function moneyCents(value: string): bigint {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value)) throw new Error('Importe inválido');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function sumPaymentAmounts(amounts: string[]): string {
  const total = amounts.reduce((sum, amount) => sum + moneyCents(amount || '0'), 0n);
  return `${total / 100n}.${String(total % 100n).padStart(2, '0')}`;
}
