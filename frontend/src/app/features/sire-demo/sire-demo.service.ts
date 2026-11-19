import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { SireClassification, SireContext, SireDocumentsResponse, SireProposalListResponse, SireProposalResponse, SireReconciliation, SireRegister, SireSource } from './sire-demo.model';

@Injectable({ providedIn: 'root' })
export class SireDemoService {
  private readonly api = inject(ApiClient);
  context(): Observable<SireContext> { return this.api.get('sire-demo/context'); }
  documents(register: SireRegister, query: { source: SireSource; period: string; page?: number; pageSize?: number }): Observable<SireDocumentsResponse> { return this.api.get(`sire-demo/registers/${register.toLowerCase()}/documents`, clean(query)); }
  sampleFile(register: SireRegister, query: { source: SireSource; period: string }): Observable<Blob> { return this.api.download(`sire-demo/registers/${register.toLowerCase()}/sample-file`, clean(query)); }
  uploadProposal(file: File, source: SireSource, register: SireRegister, period: string): Observable<SireProposalResponse> { const body = new FormData(); body.append('file', file); body.append('source', source); body.append('register', register); body.append('period', period); return this.api.post('sire-demo/proposals', body); }
  listProposals(query: { source?: SireSource; register?: SireRegister; period?: string; status?: string; page?: number; pageSize?: number }): Observable<SireProposalListResponse> { return this.api.get('sire-demo/proposals', clean(query)); }
  discardProposal(id: string): Observable<SireProposalResponse> { return this.api.post(`sire-demo/proposals/${id}/discard`, {}); }
  reconciliation(id: string, query: { classification?: SireClassification; page?: number; pageSize?: number }): Observable<SireReconciliation> { return this.api.get(`sire-demo/proposals/${id}/reconciliation`, clean(query)); }
  exportReconciliation(id: string, classification?: SireClassification): Observable<Blob> { return this.api.download(`sire-demo/proposals/${id}/reconciliation/export.xlsx`, clean({ classification })); }
}
function clean(query: object): QueryParams { return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined)) as QueryParams; }
