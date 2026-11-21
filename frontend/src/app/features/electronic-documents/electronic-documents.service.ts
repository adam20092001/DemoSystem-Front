import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DocumentPdfService } from '../../core/documents/document-pdf.service';
import { ApiClient, QueryParams } from '../../core/http/api-client.service';
import { PaginatedResponse } from '../../core/models/paginated-response.model';
import { ElectronicDocument, ElectronicDocumentListItem, ElectronicDocumentQuery, FiscalDocumentType, FiscalSeries } from './electronic-document.model';

@Injectable({ providedIn: 'root' })
export class ElectronicDocumentsService {
  private readonly api = inject(ApiClient); private readonly pdf = inject(DocumentPdfService);
  list(query: ElectronicDocumentQuery): Observable<PaginatedResponse<ElectronicDocumentListItem>> { return this.api.get<PaginatedResponse<ElectronicDocumentListItem>>('electronic-documents', clean(query)); }
  detail(id: string): Observable<ElectronicDocument> { return this.api.get<ElectronicDocument>(`electronic-documents/${id}`); }
  listSeries(documentType?: FiscalDocumentType): Observable<FiscalSeries[]> { return this.api.get<FiscalSeries[]>('fiscal-series', documentType ? { documentType, active: true } : { active: true }); }
  issue(saleId: string, documentType: FiscalDocumentType, series: string): Observable<ElectronicDocument> { return this.api.post<ElectronicDocument, { documentType: FiscalDocumentType; series: string }>(`sales/${saleId}/electronic-documents`, { documentType, series }); }
  retry(id: string): Observable<ElectronicDocument> { return this.api.post<ElectronicDocument, Record<string, never>>(`electronic-documents/${id}/retry`, {}); }
  openPrint(id: string): void { this.pdf.openElectronic(id); }
}
function clean(query: ElectronicDocumentQuery): QueryParams { return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== '')) as QueryParams; }
