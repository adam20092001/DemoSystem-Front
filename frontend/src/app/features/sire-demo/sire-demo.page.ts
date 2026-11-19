import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiRequestError } from '../../core/errors/api-request.error';
import { saveDownload } from '../../core/http/file-download';
import { money, requestErrorMessage, shortDate } from '../commercial/commercial.util';
import { SireClassification, SireContext, SireDocumentsResponse, SirePeriodCount, SireProposal, SireRegister, SireReconciliation, SireSource, SireSourceInfo } from './sire-demo.model';
import { SireDemoService } from './sire-demo.service';

@Component({
  selector: 'app-sire-demo', imports: [FormsModule, KeyValuePipe], templateUrl: './sire-demo.page.html',
  styleUrls: ['../commercial/commercial-page.shared.scss', './sire-demo.page.scss'], changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SireDemoPage implements OnInit {
  private readonly api = inject(SireDemoService);
  protected readonly auth = inject(AuthService);
  protected readonly context = signal<SireContext | null>(null);
  protected readonly documents = signal<SireDocumentsResponse | null>(null);
  protected readonly proposals = signal<SireProposal[]>([]);
  protected readonly reconciliation = signal<SireReconciliation | null>(null);
  protected readonly selectedProposal = signal<SireProposal | null>(null);
  protected readonly loading = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly unavailable = signal(false);
  protected register: SireRegister = 'RVIE';
  protected source: SireSource = 'POS';
  protected period = '';
  protected classification = '';
  protected file: File | null = null;
  protected readonly canWrite = computed(() => this.auth.role() === 'ADMIN' || this.auth.role() === 'ACCOUNTANT');
  protected sourceInfo(): SireSourceInfo | null { return this.context()?.sources.find(item => item.source === this.source) ?? null; }
  protected periods(): SirePeriodCount[] { return this.sourceInfo()?.registers[this.register].periods ?? []; }
  protected readonly classifications: Array<{ value: SireClassification; label: string }> = [
    { value: 'MATCHED', label: 'Coincidentes' }, { value: 'MISSING_IN_POS', label: 'Faltan en ventas' },
    { value: 'MISSING_IN_PROPOSAL', label: 'Faltan en propuesta' }, { value: 'AMOUNT_MISMATCH', label: 'Diferencia de monto' },
    { value: 'PARTY_MISMATCH', label: 'Diferencia de contraparte' }, { value: 'DATE_MISMATCH', label: 'Diferencia de fecha' },
    { value: 'DUPLICATE_IN_PROPOSAL', label: 'Duplicado en propuesta' }, { value: 'INSUFFICIENT_DATA', label: 'Datos insuficientes' },
  ];

  ngOnInit(): void { this.loadContext(); }
  protected loadContext(): void {
    this.api.context().pipe(take(1)).subscribe({
      next: context => { this.context.set(context); this.unavailable.set(false); this.ensurePeriod(); this.loadDocuments(); this.loadProposals(); },
      error: error => { if (error instanceof ApiRequestError && error.status === 404) this.unavailable.set(true); else this.error.set(requestErrorMessage(error)); },
    });
  }
  protected switchRegister(register: SireRegister): void { this.register = register; this.period = ''; this.clearSelection(); this.ensurePeriod(); this.loadDocuments(); this.loadProposals(); }
  protected switchSource(source: SireSource): void { this.source = source; this.period = ''; this.clearSelection(); this.ensurePeriod(); this.loadDocuments(); this.loadProposals(); }
  protected applyPeriod(event: Event): void { event.preventDefault(); this.clearSelection(); this.loadDocuments(); this.loadProposals(); }
  protected loadDocuments(page = 1): void {
    if (!this.period || !this.sourceInfo()?.available) { this.documents.set(null); return; }
    this.loading.set(true); this.error.set(null);
    this.api.documents(this.register, { source: this.source, period: this.period, page, pageSize: 20 }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: value => this.documents.set(value), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected loadProposals(): void {
    if (!this.period || !this.sourceInfo()?.available) { this.proposals.set([]); return; }
    this.api.listProposals({ source: this.source, register: this.register, period: this.period, page: 1, pageSize: 50 }).pipe(take(1)).subscribe({ next: value => this.proposals.set(value.items), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected sampleFile(): void {
    if (!this.period) return;
    this.api.sampleFile(this.register, { source: this.source, period: this.period }).pipe(take(1)).subscribe({ next: blob => saveDownload(blob, `sire-demo-${this.register.toLowerCase()}-${this.period}.txt`), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected fileChanged(event: Event): void { const input = event.target as HTMLInputElement; this.file = input.files?.[0] ?? null; input.value = ''; this.error.set(null); }
  protected upload(): void {
    if (!this.file || !this.period) { this.error.set('Selecciona un archivo .txt y un periodo.'); return; }
    if (!this.file.name.toLowerCase().endsWith('.txt')) { this.error.set('El archivo debe tener formato .txt.'); return; }
    this.uploading.set(true); this.error.set(null);
    this.api.uploadProposal(this.file, this.source, this.register, this.period).pipe(take(1), finalize(() => this.uploading.set(false))).subscribe({
      next: result => { this.notice.set(result.reused ? 'La propuesta ya estaba cargada.' : 'Propuesta cargada correctamente.'); this.file = null; this.loadProposals(); this.selectProposal(result.proposal); },
      error: error => this.error.set(requestErrorMessage(error)),
    });
  }
  protected selectProposal(proposal: SireProposal): void {
    this.selectedProposal.set(proposal); this.reconciliation.set(null); this.classification = '';
    if (proposal.status !== 'IMPORTED' || !proposal.reconcilable) return;
    this.loadReconciliation();
  }
  protected loadReconciliation(page = 1): void {
    const proposal = this.selectedProposal(); if (!proposal) return;
    this.loading.set(true); this.error.set(null);
    this.api.reconciliation(proposal.id, { classification: this.classification as SireClassification || undefined, page, pageSize: 50 }).pipe(take(1), finalize(() => this.loading.set(false))).subscribe({ next: value => this.reconciliation.set(value), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected applyClassification(event: Event): void { event.preventDefault(); this.loadReconciliation(1); }
  protected exportReconciliation(): void {
    const proposal = this.selectedProposal(); if (!proposal) return;
    this.api.exportReconciliation(proposal.id, this.reconciliation()?.classification ?? undefined).pipe(take(1)).subscribe({ next: blob => saveDownload(blob, `sire-demo-${proposal.register.toLowerCase()}-${proposal.period}.xlsx`), error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected discard(proposal: SireProposal): void {
    if (!confirm('¿Descartar esta propuesta? Se conservará el historial, pero no podrá conciliarse.')) return;
    this.api.discardProposal(proposal.id).pipe(take(1)).subscribe({ next: () => { this.notice.set('Propuesta descartada.'); this.loadProposals(); if (this.selectedProposal()?.id === proposal.id) { this.selectedProposal.set(null); this.reconciliation.set(null); } }, error: error => this.error.set(requestErrorMessage(error)) });
  }
  protected previousReconciliation(): void { const result = this.reconciliation(); if (result && result.page > 1) this.loadReconciliation(result.page - 1); }
  protected nextReconciliation(): void { const result = this.reconciliation(); if (result && result.page < Math.ceil(result.totalItems / result.pageSize)) this.loadReconciliation(result.page + 1); }
  protected formatMoney(value: string): string { return money(value); }
  protected formatDate(value: string): string { return shortDate(value); }
  protected classificationLabel(value: string): string { return this.classifications.find(item => item.value === value)?.label ?? value; }
  protected flagLabel(value: string): string { return value.replaceAll('_', ' ').toLowerCase(); }
  protected documentLabel(item: { series: string; number: string }): string { return `${item.series}-${item.number}`; }
  private ensurePeriod(): void { const options = this.periods(); if (!options.some(item => item.period === this.period)) this.period = options[0]?.period ?? ''; }
  private clearSelection(): void { this.documents.set(null); this.proposals.set([]); this.selectedProposal.set(null); this.reconciliation.set(null); this.classification = ''; this.file = null; }
}
