import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

@Component({
  selector: 'app-pdf-preview',
  template: `
    <nav aria-label="Controles del documento"><button type="button" (click)="turn(-1)" [disabled]="rendering() || page() <= 1">Anterior</button><span>Página {{ page() }} de {{ total() || '…' }}</span><button type="button" (click)="turn(1)" [disabled]="rendering() || page() >= total()">Siguiente</button><button type="button" aria-label="Reducir documento" (click)="zoom(-0.25)" [disabled]="rendering() || scale() <= 0.5">−</button><span>{{ (scale() * 100).toFixed(0) }}%</span><button type="button" aria-label="Ampliar documento" (click)="zoom(0.25)" [disabled]="rendering() || scale() >= 2">＋</button></nav>
    @if (rendering()) { <p role="status">Preparando página…</p> }
    @if (error()) { <p role="alert">{{ error() }}</p> }
    <div class="pdf-stage" #stage><canvas #canvas role="img" [attr.aria-label]="'Página ' + page() + ' del documento'"></canvas></div>
  `,
  styles: [':host{display:flex;flex-direction:column;min-height:0;flex:1;background:#e7ebef}nav{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:10px;background:var(--surface);font-size:12px;border-bottom:1px solid var(--line)}button{border:1px solid var(--line);border-radius:6px;padding:6px 10px;background:var(--surface);cursor:pointer}button:disabled{opacity:.45;cursor:default}.pdf-stage{overflow:auto;flex:1;min-height:0;padding:12px;text-align:center}canvas{display:block;margin:auto;background:white;box-shadow:0 2px 12px #0002}p{padding:8px 16px;font-size:12px;text-align:center}'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfPreviewComponent implements AfterViewInit {
  readonly blob = input.required<Blob>();
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly scale = signal(1);
  protected readonly rendering = signal(false);
  protected readonly error = signal('');
  private document: PDFDocumentProxy | null = null;
  private loadingTask: PDFDocumentLoadingTask | null = null;
  private renderTask: RenderTask | null = null;
  private alive = true;
  constructor() { inject(DestroyRef).onDestroy(() => { this.alive = false; this.renderTask?.cancel(); void this.loadingTask?.destroy(); }); }
  ngAfterViewInit(): void { void this.load(); }
  private async load(): Promise<void> {
    this.rendering.set(true);
    try {
      const pdfjs = await import('pdfjs-dist');
      const assets = new URL('assets/pdfjs/', window.document.baseURI).href;
      pdfjs.GlobalWorkerOptions.workerSrc = assets + 'pdf.worker.min.mjs';
      if (!this.alive) return;
      this.loadingTask = pdfjs.getDocument({ data: new Uint8Array(await this.blob().arrayBuffer()), standardFontDataUrl: assets + 'standard_fonts/', cMapUrl: assets + 'cmaps/', cMapPacked: true, wasmUrl: assets + 'wasm/', disableWorkerRendering: true, enableHWA: false });
      this.document = await this.loadingTask.promise;
      if (!this.alive) return;
      this.total.set(this.document.numPages); await this.render();
    } catch { if (this.alive) this.error.set('No se pudo mostrar este PDF. Puedes descargar el archivo original.'); }
    finally { if (this.alive) this.rendering.set(false); }
  }
  protected turn(delta: number): void { if (this.rendering() || !this.document) return; this.page.update(page => Math.min(this.total(), Math.max(1, page + delta))); void this.render(); }
  protected zoom(delta: number): void { if (this.rendering() || !this.document) return; this.scale.update(scale => Math.min(2, Math.max(0.5, scale + delta))); void this.render(); }
  private async render(): Promise<void> {
    if (!this.document || !this.alive) return;
    this.rendering.set(true);
    try {
      const page = await this.document.getPage(this.page()); if (!this.alive) return;
      const base = page.getViewport({ scale: 1 });
      const width = Math.max(240, this.stage().nativeElement.clientWidth - 24);
      const viewport = page.getViewport({ scale: Math.min(1.5, width / base.width) * this.scale() });
      const ratio = Math.min(window.devicePixelRatio || 1, 2, 4096 / Math.max(viewport.width, viewport.height));
      const canvas = this.canvas().nativeElement; canvas.width = Math.floor(viewport.width * ratio); canvas.height = Math.floor(viewport.height * ratio); canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
      this.renderTask = page.render({ canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await this.renderTask.promise;
    } catch { if (this.alive) this.error.set('No se pudo mostrar esta página. Puedes descargar el documento.'); }
    finally { if (this.alive) this.rendering.set(false); }
  }
}
