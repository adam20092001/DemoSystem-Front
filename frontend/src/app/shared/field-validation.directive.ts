import { DestroyRef, Directive, ElementRef, effect, inject } from '@angular/core';
import { FieldErrorsService } from '../core/errors/field-errors.service';

/** Valida campos obligatorios de los formularios existentes antes de enviarlos. */
@Directive({ selector: '[appFieldValidation]' })
export class FieldValidationDirective {
  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement;
    const errors = inject(FieldErrorsService);
    let lastScope: Element | null = null;
    effect(() => {
      const fields = errors.errors();
      if (!lastScope?.isConnected || !fields.length) return;
      let first: HTMLElement | null = null;
      for (const error of fields) {
        const escaped = CSS.escape(error.field);
        const match = lastScope.querySelector(`[data-api-field="${escaped}"], [name="${escaped}"]`);
        const field = match instanceof HTMLInputElement || match instanceof HTMLSelectElement || match instanceof HTMLTextAreaElement ? match : match?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
        if (!field || field.disabled) continue;
        this.mark(field, true, error.type === 'REQUIRED' ? 'Completa este campo.' : error.type === 'FORMAT' ? 'Revisa el formato ingresado.' : error.message);
        first ??= field;
      }
      first?.focus(); first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    const validate = (event: Event) => {
      const target = event.target as HTMLElement;
      const button = target.closest('button');
      if (event.type === 'click' && (!button || button.disabled || !/^(guardar|registrar|crear|ingresar|confirmar|enviar|actualizar|vincular)/i.test(button.textContent?.trim() ?? ''))) return;
      const scope = event.type === 'submit' ? target : button?.closest('[data-validation-scope], .dialog, .modal, form');
      if (!scope) return;
      lastScope = scope;
      let first: HTMLElement | null = null;
      scope.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:not([type="hidden"]):not([type="file"]):not([data-calendar-proxy]), select, textarea').forEach(field => {
        if (field.disabled || field.getClientRects().length === 0) return;
        const label = field.closest('label');
        const labelRequired = label?.querySelector(':scope > span')?.textContent?.includes('*') && label?.querySelector('input, select, textarea') === field;
        const required = field.required || labelRequired;
        const invalid = (required && (!field.value.trim() || field.value === '__add')) || !field.validity.valid || (field.hasAttribute('data-positive') && Number(field.value) <= 0);
        this.mark(field, !!invalid, required && !field.value.trim() ? 'Completa este campo.' : 'Revisa el valor ingresado.');
        if (invalid && !first) first = field;
      });
      if (first) { event.preventDefault(); event.stopImmediatePropagation(); (first as HTMLElement).focus(); (first as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    };
    const clear = (event: Event) => {
      const field = event.target;
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) this.mark(field, false, '');
    };
    host.addEventListener('click', validate, true);
    host.addEventListener('submit', validate, true);
    host.addEventListener('input', clear);
    host.addEventListener('change', clear);
    inject(DestroyRef).onDestroy(() => {
      host.removeEventListener('click', validate, true); host.removeEventListener('submit', validate, true);
      host.removeEventListener('input', clear); host.removeEventListener('change', clear);
    });
  }
  private mark(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, invalid: boolean, message: string): void {
    field.classList.toggle('field-invalid', invalid);
    const label = field.closest('label');
    label?.querySelector('.field-validation-message')?.remove();
    if (invalid) {
      field.setAttribute('aria-invalid', 'true');
      const text = document.createElement('small'); text.className = 'field-validation-message'; text.textContent = message;
      label?.append(text);
    } else field.removeAttribute('aria-invalid');
  }
}
