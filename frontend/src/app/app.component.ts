import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationHostComponent } from './core/notifications/notification-host.component';
import { FieldValidationDirective } from './shared/field-validation.directive';

@Component({
  selector: 'app-root',
  hostDirectives: [FieldValidationDirective],
  imports: [RouterOutlet, NotificationHostComponent],
  template: '<router-outlet /><app-notification-host />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
