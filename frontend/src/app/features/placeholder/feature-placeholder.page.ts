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
    .head h1 { font-size: 27px; font-weight: 800; letter-spacing: -0.025em; margin: 7px 0 5px; }
    .head .desc { color: var(--muted); font-size: 13.5px; margin: 0; max-width: 60ch; }
    .empty {
      margin-top: 26px; min-height: 380px; padding: 40px 24px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
      background:
        radial-gradient(60% 60% at 50% 30%, var(--surface-2), transparent 70%),
        var(--surface);
    }
    .glyph {
      width: 60px; height: 60px; display: grid; place-items: center; margin-bottom: 20px;
      border-radius: var(--r-lg); background: var(--brand-tint); color: var(--brand-ink);
      font-size: 20px; font-weight: 800; letter-spacing: 0.02em;
    }
    .empty h2 { font-size: 19px; font-weight: 700; margin: 8px 0 10px; }
    .empty-desc { color: var(--muted); font-size: 13.5px; line-height: 1.6; max-width: 46ch; margin: 0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturePlaceholderPage {
  protected readonly data = inject(ActivatedRoute).snapshot.data;
  protected readonly initials = String(this.data['title']).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
