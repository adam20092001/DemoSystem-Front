import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiRequestError } from '../../core/errors/api-request.error';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { ElectronicDocument, ElectronicDocumentListItem, ElectronicDocumentStatus, FiscalDocumentType } from './electronic-document.model';
import { ElectronicDocumentsService } from './electronic-documents.service';

@Component({ selector: 'app-electronic-documents', imports: [FormsModule], templateUrl: './electronic-documents.page.html', styleUrl: './electronic-documents.page.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ElectronicDocumentsPage implements OnInit {
  protected readonly service = inject(ElectronicDocumentsService); private readonly auth = inject(AuthService);
  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  protected readonly result = signal<PaginatedResponse<ElectronicDocumentListItem> | null>(null); protected readonly detail = signal<ElectronicDocument | null>(null);
  protected readonly loading = signal(false); protected readonly actionLoading = signal(false); protected readonly error = signal<string | null>(null); protected readonly notice = signal<string | null>(null);
  protected readonly types: FiscalDocumentType[] = ['FACTURA', 'BOLETA']; protected readonly statuses: ElectronicDocumentStatus[] = ['CREATED','SUBMITTED','SUBMISSION_FAILED','ACCEPTED','REJECTED']; protected readonly pageSizes = [10,20,50];
  protected documentType = ''; protected status = ''; protected series = ''; protected customerDocumentNumber = ''; protected issuedFrom = ''; protected issuedTo = ''; protected pageSize = 20;
  ngOnInit(): void { this.load(); }
  protected apply(event: Event): void { event.preventDefault(); this.load(1); }
  protected clear(): void { this.documentType=''; this.status=''; this.series=''; this.customerDocumentNumber=''; this.issuedFrom=''; this.issuedTo=''; this.load(1); }
  protected previous(): void { const page=this.result()?.page??1; if(page>1)this.load(page-1); } protected next(): void { const value=this.result(); if(value&&value.page<value.totalPages)this.load(value.page+1); }
  protected openDetail(id: string): void { this.actionLoading.set(true); this.error.set(null); this.service.detail(id).pipe(take(1),finalize(()=>this.actionLoading.set(false))).subscribe({next:value=>this.detail.set(value),error:error=>this.error.set(message(error))}); }
  protected retry(document: ElectronicDocument): void { this.actionLoading.set(true); this.error.set(null); this.service.retry(document.id).pipe(take(1),finalize(()=>this.actionLoading.set(false))).subscribe({next:value=>{this.detail.set(value);this.notice.set(`Se procesó nuevamente ${value.fullNumber}.`);this.load(this.result()?.page??1);},error:error=>this.error.set(message(error))}); }
  protected typeLabel(value: FiscalDocumentType): string { return value==='FACTURA'?'Factura':'Boleta'; }
  protected statusLabel(value: ElectronicDocumentStatus): string { return {CREATED:'Creado',SUBMITTED:'Enviado',SUBMISSION_FAILED:'Error de envío',ACCEPTED:'Aceptado',REJECTED:'Rechazado'}[value]; }
  protected statusClass(value: ElectronicDocumentStatus): string { return value==='ACCEPTED'?'badge--ok':value==='REJECTED'?'badge--danger':value==='SUBMISSION_FAILED'?'badge--warn':value==='SUBMITTED'?'badge--info':'badge--neutral'; }
  protected formatMoney(value: string, currency='PEN'): string { try{return new Intl.NumberFormat('es-PE',{style:'currency',currency}).format(Number(value));}catch{return `${currency} ${Number(value).toFixed(2)}`;} }
  protected formatDate(value: string): string { return new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)); }
  protected range(): string { const value=this.result();if(!value?.total)return'0 resultados';const from=(value.page-1)*value.limit+1;return`${from}–${Math.min(value.page*value.limit,value.total)} de ${value.total}`; }
  protected load(page=1): void { this.loading.set(true);this.error.set(null);this.service.list({page,limit:this.pageSize,...(this.documentType?{documentType:this.documentType as FiscalDocumentType}:{}),...(this.status?{status:this.status as ElectronicDocumentStatus}:{}),...(this.series.trim()?{series:this.series.trim().toUpperCase()}:{}),...(this.customerDocumentNumber.trim()?{customerDocumentNumber:this.customerDocumentNumber.trim()}:{}),...(this.issuedFrom?{issuedFrom:this.issuedFrom}:{}),...(this.issuedTo?{issuedTo:this.issuedTo}:{})}).pipe(take(1),finalize(()=>this.loading.set(false))).subscribe({next:value=>this.result.set(value),error:error=>this.error.set(message(error))}); }
}
function message(error: unknown): string { return error instanceof ApiRequestError?error.message:'No se pudo completar la operación.'; }
