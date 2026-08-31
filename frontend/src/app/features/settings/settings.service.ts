import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { CompanySettings, DocumentSequence, DocumentType, UpdateCompanySettings, UpdateDocumentSequence } from './settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiClient);

  getConfiguration(): Observable<CompanySettings> {
    return this.api.get<CompanySettings>('configuration');
  }

  updateConfiguration(request: UpdateCompanySettings): Observable<CompanySettings> {
    return this.api.patch<CompanySettings, UpdateCompanySettings>('configuration', request);
  }

  listSequences(): Observable<DocumentSequence[]> {
    return this.api.get<DocumentSequence[]>('configuration/sequences');
  }

  updateSequence(documentType: DocumentType, request: UpdateDocumentSequence): Observable<DocumentSequence> {
    return this.api.patch<DocumentSequence, UpdateDocumentSequence>(`configuration/sequences/${documentType}`, request);
  }
}
