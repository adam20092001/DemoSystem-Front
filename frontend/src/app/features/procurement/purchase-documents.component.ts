import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { finalize, firstValueFrom, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiClient } from '../../core/http/api-client.service';
import { saveDownload } from '../../core/http/file-download';
import { visibleErrorSignal } from '../../core/notifications/notification.service';
import { requestErrorMessage, shortDate } from '../commercial/commercial.util';
import { attachmentError } from './purchase-document.util';
import { PdfPreviewComponent } from '../../shared/pdf-preview.component';

export interface PurchaseDocument { id: string; purchaseInvoiceId: string; fileName: string; mimeType: string; fileSize: number; uploadedAt: string; uploadedByUserId: string; status: 'ACTIVE'; canDelete: boolean; previewable: boolean; idempotentReplay?: boolean }
interface UploadItem { file: File; key: string; status: 'pending' | 'uploading' | 'done' | 'failed' }

@Component({
  selector: 'app-purchase-documents',
  imports: [PdfPreviewComponent],
  templateUrl: './purchase-documents.component.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './purchase-documents.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseDocumentsComponent {
  protected readonly formatDate = shortDate;
  readonly invoiceId = input('');
  readonly operationId = input('');
  readonly invoiceStatus = input('');
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  protected readonly documents = signal<PurchaseDocument[]>([]);
  protected readonly loading = signal(false);
  protected readonly uploading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = visibleErrorSignal();
  protected readonly queue = signal<UploadItem[]>([]);
  protected readonly previewDocument = signal<PurchaseDocument | null>(null);
  protected readonly previewUrl = signal('');
  protected readonly previewBlob = signal<Blob | null>(null);
  protected readonly pendingRemoval = signal<PurchaseDocument | null>(null);
  protected readonly canWrite = computed(() => !this.operationId() && !!this.invoiceId() && ['ADMIN', 'PURCHASING'].includes(this.auth.role()) && ['DRAFT', 'CONFIRMED'].includes(this.invoiceStatus()));
  private alive = true;
  private currentPath = '';
  constructor() {
    effect(() => { const path = this.basePath(); this.invoiceStatus(); if (path) untracked(() => { if (path !== this.currentPath) { this.currentPath = path; this.documents.set([]); this.queue.set([]); this.pendingRemoval.set(null); this.closePreview(); } this.load(path); }); });
    inject(DestroyRef).onDestroy(() => { this.alive = false; this.closePreview(); });
  }
  private basePath(): string { return this.operationId() ? `import-operations/${this.operationId()}/documents` : this.invoiceId() ? `purchase-invoices/${this.invoiceId()}/attachments` : ''; }
  protected load(path = this.basePath()): void {
    if (!path) return;
    this.loading.set(true);
    this.api.get<PurchaseDocument[] | { purchaseInvoiceId: string | null; documents: PurchaseDocument[] }>(path).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: response => { if (path === this.basePath()) this.documents.set(Array.isArray(response) ? response : response.documents); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected selectFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []); input.value = '';
    if (this.uploading()) return;
    const valid: UploadItem[] = [];
    for (const file of files) {
      const error = attachmentError(file); if (error) { this.error.set(error); continue; }
      valid.push({ file, key: crypto.randomUUID(), status: 'pending' });
    }
    this.queue.update(items => [...items, ...valid]);
    if (valid.length) void this.upload();
  }
  protected async upload(): Promise<void> {
    if (!this.canWrite() || this.uploading()) return;
    this.uploading.set(true); this.error.set(null);
    const invoiceId = this.invoiceId();
    try {
      for (const item of this.queue().filter(item => item.status === 'pending' || item.status === 'failed')) {
        if (!this.alive || invoiceId !== this.invoiceId()) break;
        this.setState(item, 'uploading'); const body = new FormData(); body.append('file', item.file);
        try {
          const saved = await firstValueFrom(this.api.post<PurchaseDocument>(`purchase-invoices/${invoiceId}/attachments`, body, { 'Idempotency-Key': item.key }));
          if (!this.alive || invoiceId !== this.invoiceId()) break;
          this.documents.update(items => [...items.filter(doc => doc.id !== saved.id), saved]); this.setState(item, 'done');
        } catch (error) { if (!this.alive || invoiceId !== this.invoiceId()) break; this.setState(item, 'failed'); this.error.set(`${item.file.name}: ${requestErrorMessage(error)}`); }
      }
    } finally { if (this.alive) { this.uploading.set(false); this.load(); } }
  }
  private setState(item: UploadItem, status: UploadItem['status']): void { this.queue.update(items => items.map(entry => entry.key === item.key ? { ...entry, status } : entry)); }
  protected hasFailures(): boolean { return this.queue().some(item => item.status === 'failed'); }
  protected discard(key: string): void { if (!this.uploading()) this.queue.update(items => items.filter(item => item.key !== key)); }
  protected statusLabel(status: UploadItem['status']): string { return { pending: 'Pendiente', uploading: 'Subiendo…', done: 'Guardado', failed: 'No se pudo cargar · reintenta' }[status]; }
  protected size(bytes: number): string { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`; }
  protected download(document: PurchaseDocument): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.download(`${this.basePath()}/${document.id}/download`).pipe(take(1), finalize(() => this.busy.set(false))).subscribe({ next: blob => saveDownload(blob, document.fileName), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected preview(document: PurchaseDocument): void {
    if (this.busy()) return;
    this.busy.set(true); this.closePreview();
    this.api.download(`${this.basePath()}/${document.id}/preview`).pipe(take(1), finalize(() => this.busy.set(false))).subscribe({ next: blob => {
      if (!this.alive) return;
      const url = URL.createObjectURL(new Blob([blob], { type: document.mimeType }));
      this.previewUrl.set(url); this.previewBlob.set(blob); this.previewDocument.set(document);
    }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected closePreview(): void { if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()); this.previewUrl.set(''); this.previewBlob.set(null); this.previewDocument.set(null); }
  protected remove(document: PurchaseDocument): void {
    if (this.busy() || !document.canDelete || !this.canWrite() || this.invoiceStatus() !== 'DRAFT') return;
    this.pendingRemoval.set(document);
  }
  protected confirmRemoval(): void {
    const document = this.pendingRemoval();
    if (!document || this.busy() || this.uploading() || !this.canWrite() || this.invoiceStatus() !== 'DRAFT') return;
    this.busy.set(true);
    this.api.delete<void>(`purchase-invoices/${this.invoiceId()}/attachments/${document.id}`).pipe(take(1), finalize(() => this.busy.set(false))).subscribe({ next: () => { this.pendingRemoval.set(null); this.documents.update(items => items.filter(item => item.id !== document.id)); }, error: error => this.error.set(requestErrorMessage(error)) });
  }
}
