import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { jsPDF } from 'jspdf';
import { PdfLayout } from './pdf-layout';
import { ApiClient } from '../http/api-client.service';
import { NotificationService } from '../notifications/notification.service';
import type { QuoteDetail, SaleDetail } from '../../features/commercial/commercial.model';
import type { ProductDetail } from '../../features/catalog/catalog.model';
import { dateTime, shortDate } from '../../features/commercial/commercial.util';
import type { ElectronicDocument } from '../../features/electronic-documents/electronic-document.model';

@Injectable({ providedIn: 'root' })
export class DocumentPdfService {
  private readonly api = inject(ApiClient);
  private readonly notifications = inject(NotificationService);

  openQuote(id: string): void {
    this.open(async () => {
      const quote = await firstValueFrom(this.api.get<QuoteDetail>(`quotes/${id}`));
      const layout = new PdfLayout(new jsPDF({ unit: 'mm', format: 'a4' }), 'Cotización comercial');
      layout.header('COTIZACIÓN', quote.number, quote.currencyCode);
      layout.line('Fecha de emisión', shortDate(quote.issueDate));
      layout.line('Válida hasta', shortDate(quote.expirationDate));
      layout.line('Estado', quote.status);
      layout.section('Cliente');
      layout.line('Nombre', quote.customerName);
      layout.line('Documento', [quote.customerDocumentType, quote.customerDocumentNumber].filter(Boolean).join(' '));
      layout.line('Dirección', quote.customerAddress);
      layout.section('Productos y servicios');
      for (const item of quote.items) {
        const product = await firstValueFrom(this.api.get<ProductDetail>(`products/${item.productId}`)).catch(() => null);
        const imageUrl = product?.primaryImage?.fileUrl ?? item.productImageUrl;
        layout.product({
          sku: item.productSku, name: item.productName, quantity: item.quantity,
          unit: item.unitAbbreviation, price: item.unitPrice, total: item.lineTotal,
          details: [
            Number(item.discountAmount) > 0 ? `Descuento aplicado: ${item.discountAmount}` : '',
            product?.commercialDescription ?? item.productDescription ?? '',
            ...(product?.specifications ?? item.productSpecifications ?? []).map(spec => `${spec.name}: ${spec.value}${spec.unit ? ` ${spec.unit}` : ''}`),
          ].filter(Boolean),
          image: imageUrl ? await this.loadImage(imageUrl) : undefined,
        });
      }
      const productDiscount = quote.items.reduce((sum, item) => sum + Number(item.discountAmount), 0);
      const productSubtotal = Number(quote.itemsTotal) + productDiscount;
      const summary: [string, string][] = [
        ['Subtotal de productos', productSubtotal.toFixed(2)],
        ['Descuento por productos', `- ${productDiscount.toFixed(2)}`],
      ];
      if (Number(quote.customerDiscountAmount) > 0) {
        summary.push(['Descuento general anterior', `- ${quote.customerDiscountAmount}`]);
      }
      layout.totals(quote.pricesIncludeTax ? [
        ...summary,
        ['Base imponible', quote.taxableBase], [quote.taxEnabled ? 'IGV incluido' : 'Impuesto', quote.taxAmount],
        ['Total a pagar', quote.total],
      ] : [
        ...summary,
        ['Impuesto', quote.taxAmount], ['Total', quote.total],
      ]);
      if (quote.notes) { layout.section('Notas'); layout.paragraph(quote.notes); }
      layout.paragraph('Las imágenes y fichas técnicas reflejan el catálogo vigente al generar este PDF.', [105, 118, 128]);
      return layout.finish();
    });
  }

  openSale(id: string): void {
    this.open(async () => {
      const sale = await firstValueFrom(this.api.get<SaleDetail>(`sales/${id}`));
      const layout = new PdfLayout(new jsPDF({ unit: 'mm', format: 'a4' }), 'Documento comercial no fiscal');
      layout.header('NOTA DE VENTA', sale.number, `${sale.currencyCode}  |  NO FISCAL`);
      if (sale.status === 'CANCELLED') layout.paragraph('ANULADA', [164, 46, 46]);
      layout.line('Fecha', dateTime(sale.confirmedAt));
      layout.line('Vendedor', `${sale.seller.firstName} ${sale.seller.lastName}`);
      layout.line('Cotización', sale.quote?.number);
      layout.section('Cliente');
      layout.line('Nombre', sale.customerName);
      layout.line('Documento', [sale.customerDocumentType, sale.customerDocumentNumber].filter(Boolean).join(' '));
      layout.line('Dirección', sale.customerAddress);
      layout.section('Productos y servicios');
      for (const item of sale.items) layout.product({
        sku: item.productSku, name: item.productName, quantity: item.quantity,
        unit: item.unitAbbreviation, price: item.unitPrice, total: item.lineTotal,
      });
      layout.totals(sale.pricesIncludeTax ? [
        ['Total ítems', sale.itemsTotal], ['Descuento', sale.customerDiscountAmount],
        ['Base imponible', sale.taxableBase], [sale.taxEnabled ? 'IGV incluido' : 'Impuesto', sale.taxAmount],
        ['Total a pagar', sale.total],
      ] : [
        ['Subtotal', sale.subtotal], ['Descuento', sale.discountAmount],
        ['Impuesto', sale.taxAmount], ['Total', sale.total],
      ]);
      return layout.finish();
    });
  }

  openElectronic(id: string): void {
    this.open(async () => {
      const document = await firstValueFrom(this.api.get<ElectronicDocument>(`electronic-documents/${id}`));
      const layout = new PdfLayout(new jsPDF({ unit: 'mm', format: 'a4' }), 'DEMO - NO VÁLIDO ANTE SUNAT');
      layout.header(`${document.documentType} ELECTRÓNICA - DEMO`, document.fullNumber, document.currencyCode);
      layout.paragraph('DOCUMENTO DE DEMOSTRACIÓN - NO VÁLIDO ANTE SUNAT. Este PDF no constituye un comprobante fiscal. El estado del proveedor MOCK no implica aceptación ni registro ante SUNAT.', [155, 49, 28]);
      if (document.status === 'SUBMITTED' && document.providerStatus === 'UNKNOWN_OUTCOME') layout.paragraph('Resultado del envío desconocido: no se ha confirmado aceptación ni rechazo.', [155, 49, 28]);
      layout.line('Fecha de emisión', dateTime(document.issuedAt));
      layout.line('Estado', document.status === 'ACCEPTED' && document.providerCode === 'MOCK' ? 'ACEPTADO POR PROVEEDOR DE DEMOSTRACIÓN' : document.status);
      layout.line('Venta relacionada', document.saleNumber);
      layout.section('Emisor');
      layout.line('Razón social', document.issuerBusinessName);
      layout.line('RUC', document.issuerTaxId);
      layout.line('Dirección', document.issuerAddress);
      layout.section('Cliente');
      layout.line('Nombre', document.customerName);
      layout.line('Documento', [document.customerDocumentType, document.customerDocumentNumber].filter(Boolean).join(' '));
      layout.line('Dirección', document.customerAddress);
      layout.section('Productos y servicios');
      for (const item of [...document.items].sort((a, b) => a.lineNumber - b.lineNumber)) layout.product({
        sku: item.productSku, name: item.description, quantity: item.quantity,
        unit: item.unitAbbreviation, price: item.unitPrice, total: item.lineTotal,
      });
      layout.totals(document.pricesIncludeTax ? [
        ['Total ítems', document.itemsTotal], ['Descuento', document.customerDiscountAmount],
        ['Base imponible', document.taxableBase], ['IGV', document.taxAmount],
        ['Total a pagar', document.total],
      ] : [
        ['Subtotal', document.subtotal], ['Descuento', document.discountAmount],
        ['Base imponible', document.taxableBase], ['IGV', document.taxAmount], ['Total', document.total],
      ]);
      layout.section('Proveedor electrónico');
      layout.line('Proveedor', document.providerCode);
      layout.line('Estado del proveedor', document.providerStatus);
      layout.line('Mensaje', document.providerMessage);
      return layout.finish();
    });
  }

  private open(create: () => Promise<Blob>): void {
    const tab = window.open('', '_blank');
    if (!tab) { this.notifications.error('El navegador bloqueó la nueva pestaña. Permite ventanas emergentes para abrir el PDF.'); return; }
    tab.opener = null;
    tab.document.body.textContent = 'Generando PDF…';
    void create().then(blob => {
      const url = URL.createObjectURL(blob);
      tab.location.replace(url);
    }).catch(error => {
      const message = error instanceof Error ? error.message : 'No se pudo generar el PDF.';
      this.notifications.error(message);
      tab.document.body.textContent = `No se pudo generar el PDF: ${message}`;
    });
  }

  private async loadImage(fileUrl: string): Promise<string | undefined> {
    try {
      const url = new URL(fileUrl, window.location.origin).toString();
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) return undefined;
      const bitmap = await createImageBitmap(await response.blob());
      const scale = Math.min(1, 350 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return canvas.toDataURL('image/jpeg', 0.82);
    } catch { return undefined; }
  }
}
