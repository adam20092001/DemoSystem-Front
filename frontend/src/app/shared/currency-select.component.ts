import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-currency-select',
  imports: [FormsModule],
  template: `
    <select class="input" [attr.aria-label]="label()" [required]="required()" [disabled]="disabled()"
      [ngModel]="value() || ''" [ngModelOptions]="{ standalone: true }" (ngModelChange)="valueChange.emit($event)">
      <option value="">{{ emptyLabel() }}</option>
      @for (currency of currencies(); track currency.code) {
        <option [value]="currency.code">{{ currency.code }} · {{ currency.name }}</option>
      }
    </select>
  `,
  styles: [':host{display:block;min-width:0}select{width:100%;max-width:100%}'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencySelectComponent {
  readonly value = input<string | undefined>('');
  readonly valueChange = output<string>();
  readonly label = input('Moneda');
  readonly required = input(true);
  readonly disabled = input(false);
  readonly emptyLabel = input('Seleccionar moneda');
  private readonly names = new Intl.DisplayNames(['es-PE'], { type: 'currency' });
  private readonly codes = Intl.supportedValuesOf('currency');
  protected readonly currencies = computed(() => {
    // Preserve currencies already stored on historical documents, even if the
    // browser's current reference list no longer includes their code.
    const codes = new Set(this.codes);
    const selected = this.value();
    if (selected && /^[A-Z]{3}$/.test(selected)) codes.add(selected);
    const preferred = ['PEN', 'USD', 'EUR', 'CNY', 'INR'];
    return [...codes].map(code => ({ code, name: this.names.of(code) || code })).sort((a, b) => {
      const first = preferred.indexOf(a.code), second = preferred.indexOf(b.code);
      if (first >= 0 || second >= 0) return (first < 0 ? preferred.length : first) - (second < 0 ? preferred.length : second);
      return a.name.localeCompare(b.name, 'es');
    });
  });
}
