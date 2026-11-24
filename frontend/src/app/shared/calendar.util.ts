export interface CalendarCell { iso: string; day: number; inMonth: boolean; disabled: boolean }
export function calendarCells(year: number, month: number, min = '', max = ''): CalendarCell[] {
  const start = new Date(Date.UTC(year, month, 1));
  const offset = (start.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, month, 1 - offset + index));
    const iso = date.toISOString().slice(0, 10);
    return { iso, day: date.getUTCDate(), inMonth: date.getUTCMonth() === month,
      disabled: date.getUTCFullYear() < 1000 || date.getUTCFullYear() > 9999 || !!(min && iso < min) || !!(max && iso > max) };
  });
}
export function calendarPosition(anchor: { left: number; top: number; bottom: number }, panel: { width: number; height: number }, viewport: { width: number; height: number }) {
  const gap = 6, margin = 12;
  const left = Math.max(margin, Math.min(anchor.left, viewport.width - panel.width - margin));
  const below = anchor.bottom + gap;
  const top = below + panel.height <= viewport.height - margin ? below
    : anchor.top - panel.height - gap >= margin ? anchor.top - panel.height - gap
    : Math.max(margin, (viewport.height - panel.height) / 2);
  return { left, top };
}
