import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-feature-placeholder',
  template: `
    <header class="head">
      <p class="eyebrow">{{ data['eyebrow'] }}</p>
      <h1>{{ data['title'] }}</h1>
      <p class="desc">{{ data['description'] }}</p>
    </header>
    <section class="empty surface">
      <div class="glyph">{{ initials }}</div>
      <p class="eyebrow">Módulo preparado</p>
      <h2>La base ya está conectada al layout</h2>
      <p class="empty-desc">Este módulo se construirá como una unidad independiente sobre la base transversal ya lista: navegación por rol, tokens de diseño y transporte HTTP centralizado.</p>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .head h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.015em; margin: 7px 0 5px; }
    .head .desc { color: var(--muted); font-size: 13px; margin: 0; max-width: 60ch; }
    .empty {
      margin-top: 24px; min-height: 360px; padding: 40px 24px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
    }
    .glyph {
      width: 52px; height: 52px; display: grid; place-items: center; margin-bottom: 18px;
      border-radius: var(--r-lg); background: var(--surface-2); color: var(--ink-2); border: 1px solid var(--line-strong);
      font-size: 16px; font-weight: 700; letter-spacing: 0.02em;
    }
    .empty h2 { font-size: 16px; font-weight: 600; margin: 6px 0 8px; }
    .empty-desc { color: var(--muted); font-size: 13px; line-height: 1.6; max-width: 46ch; margin: 0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturePlaceholderPage {
  protected readonly data = inject(ActivatedRoute).snapshot.data;
  protected readonly initials = String(this.data['title']).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
