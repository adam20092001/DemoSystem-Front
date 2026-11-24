import type { SaveImportOperationRequest, SaveImportShipmentRequest } from './imports.model';
const optional = (value: string | undefined) => value?.trim() || undefined;
export function operationPayload(form: SaveImportOperationRequest): SaveImportOperationRequest {
  return { purchaseInvoiceId: form.purchaseInvoiceId, description: optional(form.description), originCountry: form.originCountry.trim().toUpperCase(), destinationCountry: form.destinationCountry.trim().toUpperCase(), externalReference: optional(form.externalReference), notes: optional(form.notes) };
}
export function shipmentPayload(form: SaveImportShipmentRequest): SaveImportShipmentRequest {
  return {
    incoterm: form.incoterm || null,
    incotermNamedPlace: form.incoterm ? form.incotermNamedPlace?.trim() || null : null,
    incotermVersion: form.incoterm ? '2020' : null,
    transportMode: form.transportMode, carrierName: optional(form.carrierName), trackingReference: optional(form.trackingReference), billOfLadingNumber: optional(form.billOfLadingNumber), containerReference: optional(form.containerReference), originLocation: optional(form.originLocation), destinationLocation: optional(form.destinationLocation), estimatedDepartureDate: form.estimatedDepartureDate || undefined, estimatedArrivalDate: form.estimatedArrivalDate || undefined, notes: optional(form.notes),
    lines: form.lines.map(line => ({ productId: line.productId || undefined, descriptionSnapshot: optional(line.descriptionSnapshot), plannedQuantity: line.plannedQuantity, unitCode: optional(line.unitCode), unitName: optional(line.unitName), weightValue: optional(line.weightValue), weightUnit: optional(line.weightUnit), volumeValue: optional(line.volumeValue), volumeUnit: optional(line.volumeUnit), purchaseInvoiceLineId: line.purchaseInvoiceLineId || undefined })),
  };
}
