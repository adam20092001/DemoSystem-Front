import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationHostComponent } from './core/notifications/notification-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificationHostComponent],
  template: '<router-outlet /><app-notification-host />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
