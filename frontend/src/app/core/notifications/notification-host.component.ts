import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from './notification.service';

@Component({
  selector: 'app-notification-host',
  template: `
    <div class="notification-stack" aria-live="assertive" aria-atomic="false">
      @for (notification of notifications.notifications(); track notification.id) {
        <div class="notification" [class.notification--warning]="notification.kind === 'warning'" role="alert">
          <span class="notification__icon" aria-hidden="true">{{ notification.kind === 'error' ? '!' : '⚠' }}</span>
          <div class="notification__content">
            <strong>{{ notification.kind === 'error' ? 'No se pudo completar la acción' : 'Advertencia' }}</strong>
            <span>{{ notification.message }}</span>
          </div>
          <button type="button" (click)="notifications.dismiss(notification.id)" aria-label="Cerrar aviso">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .notification-stack { position: fixed; z-index: var(--z-tooltip); top: 16px; right: 16px; width: min(440px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; display: grid; gap: 10px; pointer-events: none; }
    .notification { pointer-events: auto; display: flex; align-items: flex-start; gap: 11px; padding: 14px; color: var(--danger-ink); background: var(--surface); border: 1px solid var(--danger); border-left: 5px solid var(--danger); border-radius: var(--r-md); box-shadow: var(--shadow-lg); }
    .notification--warning { color: var(--warn-ink); border-color: var(--warn); }
    .notification__icon { display: grid; place-items: center; flex: none; width: 22px; height: 22px; border-radius: 50%; color: white; background: var(--danger); font-weight: 800; }
    .notification--warning .notification__icon { background: var(--warn); }
    .notification__content { display: grid; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
    .notification__content strong { font-size: 13px; }
    .notification__content span { font-size: 13px; }
    button { flex: none; margin: -5px -5px 0 auto; padding: 2px 7px; border: 0; background: transparent; color: inherit; font-size: 23px; line-height: 1; }
    @media (max-width: 600px) { .notification-stack { top: 8px; right: 8px; width: calc(100vw - 16px); max-height: min(45dvh, 320px); } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationHostComponent {
  protected readonly notifications = inject(NotificationService);
}
