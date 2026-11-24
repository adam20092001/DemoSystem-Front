import { AfterViewInit, Directive, ElementRef, HostListener, Input, OnChanges, forwardRef, inject } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { formatMoneyInput, parseMoneyInput } from './input-format.util';

@Directive({
  selector: 'input[appMoney]',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MoneyInputDirective), multi: true }, { provide: NG_VALIDATORS, useExisting: forwardRef(() => MoneyInputDirective), multi: true }],
})
export class MoneyInputDirective implements ControlValueAccessor, Validator, AfterViewInit, OnChanges {
  @Input({ transform: (value: unknown) => value !== false && value !== 'false' }) appMoney = true;
  @Input() moneyDecimals = 2;
  private readonly input = inject(ElementRef<HTMLInputElement>).nativeElement;
  private value = '';
  private numericModel = false;
  private focused = false;
  private change: (value: string | number | null) => void = () => {};
  private touched: () => void = () => {};
  private validatorChanged: () => void = () => {};
  ngAfterViewInit(): void { this.input.removeAttribute('pattern'); this.input.inputMode = 'decimal'; this.check(); }
  ngOnChanges(): void { if (!this.focused) this.show(); this.check(); this.validatorChanged(); }
  writeValue(value: string | number | null | undefined): void { this.numericModel = typeof value === 'number'; this.value = value === null || value === undefined ? '' : String(value); this.show(); this.check(); }
  registerOnChange(fn: (value: string | number | null) => void): void { this.change = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(disabled: boolean): void { this.input.disabled = disabled; }
  registerOnValidatorChange(fn: () => void): void { this.validatorChanged = fn; }
  validate(_control: AbstractControl): ValidationErrors | null { return parseMoneyInput(this.value, this.moneyDecimals) === null ? { moneyFormat: true } : null; }
  @HostListener('focus') focus(): void { this.focused = true; }
  @HostListener('input') enter(): void {
    const parsed = parseMoneyInput(this.input.value, this.moneyDecimals);
    this.value = parsed ?? this.input.value;
    this.check(); this.change(this.numericModel ? parsed ? Number(parsed) : null : parsed ?? '');
  }
  @HostListener('blur') blur(): void {
    this.focused = false;
    if (this.appMoney && this.value && parseMoneyInput(this.value, this.moneyDecimals) !== null) this.value = formatMoneyInput(this.value, this.moneyDecimals).replace(/,/g, '');
    this.show(); this.check();
    const parsed = parseMoneyInput(this.value, this.moneyDecimals);
    this.change(this.numericModel ? parsed ? Number(parsed) : null : parsed ?? ''); this.touched();
  }
  private show(): void { this.input.value = !this.focused && this.appMoney ? formatMoneyInput(this.value, this.moneyDecimals) : this.value; }
  private check(): void { this.input.setCustomValidity(parseMoneyInput(this.value, this.moneyDecimals) === null ? `Ingresa un importe válido con un máximo de ${this.moneyDecimals} decimales.` : ''); }
}
