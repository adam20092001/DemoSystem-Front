import { Injectable, inject, signal, type WritableSignal } from '@angular/core';

export interface VisibleNotification {
  id: number;
  kind: 'error' | 'warning';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly entries = signal<VisibleNotification[]>([]);
  private nextId = 1;
  readonly notifications = this.entries.asReadonly();

  error(message: string): void { this.add('error', message); }
  warning(message: string): void { this.add('warning', message); }

  dismiss(id: number): void {
    this.entries.update(entries => entries.filter(entry => entry.id !== id));
  }

  private add(kind: VisibleNotification['kind'], message: string): void {
    const trimmed = message.trim();
    if (!trimmed) return;
    this.entries.update(entries => {
      if (entries.some(entry => entry.kind === kind && entry.message === trimmed)) return entries;
      return [...entries, { id: this.nextId++, kind, message: trimmed }].slice(-4);
    });
  }
}

/** Conserva el error local y también lo anuncia en una zona fija de la pantalla. */
export function visibleErrorSignal(): WritableSignal<string | null> {
  const notifications = inject(NotificationService);
  const state = signal<string | null>(null);
  const originalSet = state.set.bind(state);
  state.set = value => {
    originalSet(value);
    if (value) notifications.error(value);
  };
  state.update = updater => state.set(updater(state()));
  return state;
}
