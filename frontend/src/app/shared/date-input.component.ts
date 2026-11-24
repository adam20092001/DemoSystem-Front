import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, Input, OnChanges, forwardRef, inject, viewChild } from '@angular/core';
import { FormsModule, AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { dateInputError, displayDate, maskDateInput, parseDisplayDate } from './input-format.util';
import { calendarCells, calendarPosition } from './calendar.util';

@Component({
  selector: 'app-date-input',
  imports: [FormsModule],
  template: `<span class="date-control"><input #textInput class="input" type="text" inputmode="numeric" autocomplete="off" placeholder="DD/MM/AAAA" maxlength="10"
    [value]="display" [disabled]="disabled" [readOnly]="readonly" [required]="required" [attr.aria-label]="ariaLabel || null"
    (input)="enter($event)" (blur)="touch()" (keydown.arrowdown)="openCalendar($event)">
    @if (!readonly) { <button type="button" class="calendar-button" aria-label="Abrir calendario" title="Abrir calendario" [disabled]="disabled" [attr.aria-expanded]="calendarOpen" (click)="openCalendar($event)">▦</button> }
    <section #calendar popover="auto" class="calendar-popover" role="dialog" aria-label="Seleccionar fecha" (toggle)="calendarToggled($event)" (keydown.escape)="closeCalendar(true)">
      <header class="calendar-header"><button type="button" aria-label="Mes anterior" [disabled]="!canMove(-1)" (click)="moveMonth(-1)">‹</button>
        <select aria-label="Mes del calendario" [ngModel]="month" [ngModelOptions]="{standalone:true}" (ngModelChange)="month = +$event"><option value="0">Enero</option><option value="1">Febrero</option><option value="2">Marzo</option><option value="3">Abril</option><option value="4">Mayo</option><option value="5">Junio</option><option value="6">Julio</option><option value="7">Agosto</option><option value="8">Septiembre</option><option value="9">Octubre</option><option value="10">Noviembre</option><option value="11">Diciembre</option></select>
        <select aria-label="Año del calendario" [ngModel]="year" [ngModelOptions]="{standalone:true}" (ngModelChange)="year = +$event">@for (value of years(); track value) { <option [ngValue]="value">{{ value }}</option> }</select>
        <button type="button" aria-label="Mes siguiente" [disabled]="!canMove(1)" (click)="moveMonth(1)">›</button></header>
      <div class="weekdays" aria-hidden="true"><span>Lu</span><span>Ma</span><span>Mi</span><span>Ju</span><span>Vi</span><span>Sá</span><span>Do</span></div>
      <div class="calendar-days">@for (day of days(); track day.iso) { <button type="button" [disabled]="day.disabled" [class.other-month]="!day.inMonth" [class.selected]="day.iso === isoValue" [attr.aria-pressed]="day.iso === isoValue" [attr.aria-label]="dateLabel(day.iso)" [attr.data-current-month]="day.inMonth" (click)="chooseDay(day.iso)">{{ day.day }}</button> }</div>
      <footer><button type="button" [disabled]="!!dateInputErrorFor(today())" (click)="chooseDay(today())">Hoy</button><button type="button" (click)="closeCalendar(true)">Cerrar</button></footer>
    </section></span>`,
  styles: [`
    :host{display:block;min-width:0}.date-control{display:block;position:relative;min-width:0}.input{width:100%;max-width:100%;padding-right:40px}
    .calendar-button{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:30px;height:30px;border:0;border-radius:5px;background:transparent;color:var(--muted);font-size:21px;cursor:pointer}
    .calendar-button:hover{background:var(--surface-2);color:var(--brand)}.calendar-button:disabled{opacity:.4;cursor:default}
    .calendar-popover{position:fixed;inset:auto;margin:0;width:320px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:auto;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--surface,#fff);color:var(--ink,#172b35);box-shadow:0 12px 40px #0003}
    .calendar-header{display:grid;grid-template-columns:30px minmax(0,1fr) 82px 30px;gap:5px;align-items:center;margin-bottom:10px}
    .calendar-header select{width:100%;min-width:0;height:34px;padding:2px;border:1px solid var(--line);border-radius:6px;background:var(--surface,#fff);color:inherit;font:inherit;font-size:12px}
    .calendar-popover button{border:0;background:transparent;color:inherit;cursor:pointer;font:inherit;border-radius:6px;min-width:0}
    .calendar-header button{height:34px;font-size:24px}.weekdays,.calendar-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px}.weekdays{font-size:11px;color:var(--muted);text-align:center;margin-bottom:5px}
    .calendar-days button{height:34px;font-size:13px}.calendar-popover button:hover:not(:disabled){background:var(--brand-tint,#e6eff5)}.calendar-days button.selected{background:var(--brand,#356480);color:white}.calendar-days button.other-month{color:var(--muted)}
    .calendar-popover button:disabled{opacity:.3;cursor:default}.calendar-popover button:focus-visible{outline:2px solid var(--brand);outline-offset:1px}.calendar-popover footer{display:flex;justify-content:space-between;border-top:1px solid var(--line);margin-top:10px;padding-top:8px}.calendar-popover footer button{padding:6px 10px;font-size:12px}
  `],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInputComponent), multi: true }, { provide: NG_VALIDATORS, useExisting: forwardRef(() => DateInputComponent), multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateInputComponent implements ControlValueAccessor, Validator, AfterViewInit, OnChanges {
  @Input() min: string | null | undefined = '';
  @Input() max: string | null | undefined = '';
  @Input({ transform: (value: unknown) => value !== false && value !== null && value !== undefined && value !== 'false' }) required = false;
  @Input({ transform: (value: unknown) => value !== false && value !== null && value !== undefined && value !== 'false' }) readonly = false;
  @Input('aria-label') ariaLabel = '';
  protected display = '';
  protected disabled = false;
  protected isoValue = '';
  protected calendarOpen = false;
  protected month = 0;
  protected year = new Date().getFullYear();
  protected readonly dateLabel = displayDate;
  private readonly textInput = viewChild<ElementRef<HTMLInputElement>>('textInput');
  private readonly calendar = viewChild<ElementRef<HTMLElement>>('calendar');
  private readonly cdr = inject(ChangeDetectorRef);
  private change: (value: string) => void = () => {};
  protected touch: () => void = () => {};
  private validatorChanged: () => void = () => {};
  constructor() {
    const reposition = () => { if (this.calendarOpen) this.positionCalendar(); };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    inject(DestroyRef).onDestroy(() => { window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); });
  }
  writeValue(value: string | null | undefined): void { this.isoValue = value ?? ''; this.display = displayDate(value); this.check(); this.cdr.markForCheck(); }
  registerOnChange(fn: (value: string) => void): void { this.change = fn; }
  registerOnTouched(fn: () => void): void { this.touch = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; if (disabled) this.closeCalendar(); this.cdr.markForCheck(); }
  registerOnValidatorChange(fn: () => void): void { this.validatorChanged = fn; }
  validate(_control: AbstractControl): ValidationErrors | null { return this.message() ? { dateFormat: true } : null; }
  ngAfterViewInit(): void { this.check(); }
  ngOnChanges(): void { this.check(); this.validatorChanged(); if (this.readonly) this.closeCalendar(); }
  protected enter(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.display = maskDateInput(input.value); input.value = this.display;
    this.isoValue = parseDisplayDate(this.display) ?? '';
    this.check(); this.change(this.isoValue);
  }
  protected today(): string { const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone:'America/Lima', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date()).map(part => [part.type,part.value])); return parts['year'] + '-' + parts['month'] + '-' + parts['day']; }
  protected days() { return calendarCells(this.year, this.month, this.min ?? '', this.max ?? ''); }
  protected years(): number[] { const lower = this.min ? Number(this.min.slice(0,4)) : Math.max(1000,this.year-100); const upper = this.max ? Number(this.max.slice(0,4)) : Math.min(9999,this.year+20); return Array.from({length: Math.max(0,upper-lower+1)},(_,index)=>lower+index); }
  protected dateInputErrorFor(iso: string): string { return dateInputError(displayDate(iso),this.min ?? '',this.max ?? ''); }
  protected canMove(offset: number): boolean { const next = new Date(Date.UTC(this.year,this.month+offset,1)); return next.getUTCFullYear() >= 1000 && next.getUTCFullYear() <= 9999 && calendarCells(next.getUTCFullYear(),next.getUTCMonth(),this.min ?? '',this.max ?? '').some(day=>day.inMonth && !day.disabled); }
  protected moveMonth(offset: number): void { if (!this.canMove(offset)) return; const next = new Date(Date.UTC(this.year,this.month+offset,1)); this.year=next.getUTCFullYear(); this.month=next.getUTCMonth(); }
  protected chooseDay(value: string): void {
    if (this.disabled || this.readonly || this.dateInputErrorFor(value)) return;
    this.isoValue=value; this.display=displayDate(value); this.check(); this.change(value); this.touch(); this.closeCalendar(true);
  }
  protected openCalendar(event: Event): void {
    event.preventDefault(); if (this.disabled || this.readonly) return;
    if (this.calendarOpen) { this.closeCalendar(true); return; }
    let selected = parseDisplayDate(this.display) ?? this.today();
    if (this.min && selected < this.min) selected=this.min;
    if (this.max && selected > this.max) selected=this.max;
    this.year=Number(selected.slice(0,4)); this.month=Number(selected.slice(5,7))-1;
    this.calendarOpen=true; this.cdr.detectChanges();
    const panel=this.calendar()?.nativeElement; if (!panel) return;
    panel.showPopover(); this.positionCalendar();
    (panel.querySelector<HTMLElement>('.selected:not(:disabled)') ?? panel.querySelector<HTMLElement>('[data-current-month="true"]:not(:disabled)'))?.focus({preventScroll:true});
  }
  protected calendarToggled(event: Event): void { this.calendarOpen=(event as ToggleEvent).newState === 'open'; this.cdr.markForCheck(); }
  protected closeCalendar(focus=false): void { const panel=this.calendar()?.nativeElement; if (panel?.matches(':popover-open')) panel.hidePopover(); this.calendarOpen=false; if (focus) this.textInput()?.nativeElement.focus({preventScroll:true}); }
  private positionCalendar(): void {
    const input=this.textInput()?.nativeElement, panel=this.calendar()?.nativeElement; if (!input || !panel) return;
    const point=calendarPosition(input.getBoundingClientRect(),panel.getBoundingClientRect(),{width:window.innerWidth,height:window.innerHeight});
    panel.style.left=point.left+'px'; panel.style.top=point.top+'px';
  }
  private message(): string { return dateInputError(this.display, this.min ?? '', this.max ?? ''); }
  private check(): void { this.textInput()?.nativeElement.setCustomValidity(this.message()); }
}
