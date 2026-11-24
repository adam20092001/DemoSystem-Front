import { DestroyRef, Injectable, inject, signal, type WritableSignal } from '@angular/core';

export const NOTIFICATION_DURATION_MS = 5000;

export interface VisibleNotification {
  id: number;
  kind: 'error' | 'warning';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly entries = signal<VisibleNotification[]>([]);
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  readonly notifications = this.entries.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.timers.forEach(timer => clearTimeout(timer));
      this.timers.clear();
    });
  }

  error(message: string): void { this.add('error', message); }
  warning(message: string): void { this.add('warning', message); }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.entries.update(entries => entries.filter(entry => entry.id !== id));
  }

  private add(kind: VisibleNotification['kind'], message: string): void {
    const trimmed = message.trim();
    if (!trimmed) return;
    const duplicate = this.entries().find(entry => entry.kind === kind && entry.message === trimmed);
    if (duplicate) this.dismiss(duplicate.id);
    if (this.entries().length >= 4) this.dismiss(this.entries()[0].id);
    const id = this.nextId++;
    this.entries.update(entries => [...entries, { id, kind, message: trimmed }]);
    this.timers.set(id, setTimeout(() => this.dismiss(id), NOTIFICATION_DURATION_MS));
  }
}

/** Conserva el error local y también lo anuncia en una zona fija de la pantalla. */
export function visibleErrorSignal(): WritableSignal<string | null> {
  const notifications = inject(NotificationService);
  const state = signal<string | null>(null);
  const originalSet = state.set.bind(state);
  let timer: ReturnType<typeof setTimeout> | undefined;
  inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  state.set = value => {
    clearTimeout(timer);
    originalSet(value);
    if (value) {
      notifications.error(value);
      timer = setTimeout(() => originalSet(null), NOTIFICATION_DURATION_MS);
    }
  };
  state.update = updater => state.set(updater(state()));
  return state;
}
