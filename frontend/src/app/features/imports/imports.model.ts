export type ImportOperationStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ImportTransportMode = 'SEA' | 'AIR' | 'LAND' | 'OTHER';
export type ImportIncoterm = 'EXW' | 'FCA' | 'CPT' | 'CIP' | 'DAP' | 'DPU' | 'DDP' | 'FAS' | 'FOB' | 'CFR' | 'CIF';
export interface ImportInvoiceLine { purchaseInvoiceLineId: string; productId: string | null; productSku: string | null; description: string; unitCode: string | null; invoicedQuantity: string; assignedQuantity: string; assignedToThisOperationQuantity: string; availableQuantity: string; receivedQuantity: string; pendingReceiptQuantity: string }
export type ImportShipmentStatus = 'PLANNED' | 'IN_TRANSIT' | 'ARRIVED' | 'CANCELLED';
export type ImportExpenseCategory = 'FREIGHT' | 'INSURANCE' | 'CUSTOMS_DUTY' | 'PORT_HANDLING' | 'STORAGE' | 'INLAND_TRANSPORT' | 'OTHER';
export type ImportExpenseDocumentType = 'INVOICE' | 'RECEIPT' | 'DEBIT_NOTE' | 'OTHER';
export type ImportExpenseStatus = 'DRAFT' | 'FINALIZED' | 'CANCELLED';
export type ImportExpenseAllocationMethod = 'QUANTITY' | 'WEIGHT' | 'VOLUME' | 'MANUAL';

export interface ActorSummary { id: string; username: string; firstName: string; lastName: string }

export interface ImportOperation {
  purchaseInvoiceId: string | null;
  isLegacyUnlinked: boolean;
  purchaseInvoice: { id: string; documentLabel: string; status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'; currencyCode: string; canAssignLines: boolean; supplier: { id: string; legalName: string; documentNumber: string; countryCode: string } } | null;
  invoiceLines: ImportInvoiceLine[] | null;
  id: string; reference: string; description: string | null; originCountry: string; destinationCountry: string;
  status: ImportOperationStatus; externalReference: string | null; notes: string | null; createdBy: ActorSummary;
  createdAt: string; updatedAt: string; completedAt: string | null; completedBy: ActorSummary | null;
  cancelledAt: string | null; cancelledBy: ActorSummary | null; cancellationReason: string | null; shipmentCount: number;
}

export interface ImportShipmentLineRequest {
  productId?: string; descriptionSnapshot?: string; plannedQuantity: string; unitCode?: string; unitName?: string;
  weightValue?: string; weightUnit?: string; volumeValue?: string; volumeUnit?: string; purchaseInvoiceLineId?: string;
}

export interface ImportShipmentLine extends Omit<ImportShipmentLineRequest, 'productId' | 'descriptionSnapshot' | 'unitCode' | 'unitName' | 'weightValue' | 'weightUnit' | 'volumeValue' | 'volumeUnit' | 'purchaseInvoiceLineId'> { id: string; productId: string | null; descriptionSnapshot: string; unitCode: string | null; unitName: string | null; weightValue: string | null; weightUnit: string | null; volumeValue: string | null; volumeUnit: string | null; purchaseInvoiceLineId: string | null }

export interface ImportShipment {
  incoterm: ImportIncoterm | null;
  incotermNamedPlace: string | null;
  incotermVersion: string | null;
  id: string; importOperationId: string; transportMode: ImportTransportMode; carrierName: string | null;
  trackingReference: string | null; billOfLadingNumber: string | null; containerReference: string | null;
  originLocation: string | null; destinationLocation: string | null; estimatedDepartureDate: string | null;
  actualDepartureDate: string | null; estimatedArrivalDate: string | null; actualArrivalDate: string | null;
  status: ImportShipmentStatus; notes: string | null; createdBy: ActorSummary; createdAt: string; updatedAt: string;
  cancelledAt: string | null; cancelledBy: ActorSummary | null; cancellationReason: string | null; lines: ImportShipmentLine[];
}

export interface SaveImportOperationRequest { purchaseInvoiceId: string; description?: string; originCountry: string; destinationCountry: string; externalReference?: string; notes?: string }
export interface SaveImportShipmentRequest { incoterm?: ImportIncoterm | null; incotermNamedPlace?: string | null; incotermVersion?: string | null; transportMode: ImportTransportMode; carrierName?: string; trackingReference?: string; billOfLadingNumber?: string; containerReference?: string; originLocation?: string; destinationLocation?: string; estimatedDepartureDate?: string; estimatedArrivalDate?: string; notes?: string; lines: ImportShipmentLineRequest[] }

export interface ImportExpense {
  id: string; importOperationId: string; category: ImportExpenseCategory; description: string | null; supplierId: string | null;
  purchaseInvoiceLineId: string | null; documentType: ImportExpenseDocumentType | null; documentReference: string | null;
  expenseDate: string; currencyCode: string; amount: string; remarks: string | null; status: ImportExpenseStatus;
  createdBy: ActorSummary; createdAt: string; updatedAt: string; finalizedAt: string | null; finalizedBy: ActorSummary | null;
  cancelledAt: string | null; cancelledBy: ActorSummary | null; cancellationReason: string | null;
  allocatedAmount: string; unallocatedAmount: string;
}

export interface SaveImportExpenseRequest { category: ImportExpenseCategory; description?: string; supplierId?: string; purchaseInvoiceLineId?: string; documentType?: ImportExpenseDocumentType; documentReference?: string; expenseDate: string; currencyCode: string; amount: string; remarks?: string }
export interface AllocateImportExpenseRequest { method: ImportExpenseAllocationMethod; amountToAllocate: string; shipmentLineIds?: string[]; manualAllocations?: Array<{ importShipmentLineId: string; amount: string }>; idempotencyKey?: string }
export interface ImportExpenseAllocationBatch { id: string; importExpenseId: string; method: ImportExpenseAllocationMethod; requestedAmount: string; createdBy: ActorSummary; createdAt: string; allocations: Array<{ id: string; importShipmentLineId: string; amount: string }> }
export interface ImportExpenseAllocationPreview { method: ImportExpenseAllocationMethod; requestedAmount: string; lines: Array<{ importShipmentLineId: string; amount: string }> }

export interface ImportReceiptLink { id: string; importShipmentLineId: string; purchaseReceiptLineId: string; linkedQuantity: string; status: 'ACTIVE' | 'CANCELLED'; createdBy: ActorSummary; createdAt: string; cancelledAt: string | null; cancelledBy: ActorSummary | null; cancellationReason: string | null }
export interface ShipmentLineReceptionSummary { importShipmentLineId: string; shippedQuantity: string; linkedReceivedQuantity: string; remainingQuantity: string; receptionStatus: 'PENDING' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED'; links: ImportReceiptLink[] }
export interface CostAttributionPreview { importExpenseAllocationId: string; importShipmentLineId: string; currencyCode: string; allocatedAmount: string; lines: Array<{ purchaseReceiptLineId: string; importReceiptLinkId: string; receivedQuantity: string; attributedAmount: string }>; unattributedAmount: string; financialStatus: 'PENDING_FX' | 'PENDING_ACCOUNTING_POLICY'; financialStatusReason: string }

export interface CargoUnitAggregate { unitCode: string | null; plannedQuantity: string; linkedReceivedQuantity: string; unlinkedQuantity: string }
export interface ExpenseCurrencyAggregate { currencyCode: string; expenseCount: number; cancelledCount: number; totalAmount: string; allocatedAmount: string; unallocatedAmount: string; attributedAmount: string; unattributedAmount: string; financialStatus: string }
export interface ImportOperationSummary { purchaseInvoiceId: string | null; isLegacyUnlinked: boolean; purchaseInvoiceDocument: string | null; supplierLegalName: string | null; id: string; reference: string; status: ImportOperationStatus; originCountry: string; destinationCountry: string; createdAt: string; completedAt: string | null; cancelledAt: string | null; shipmentCountsByStatus: Record<ImportShipmentStatus, number>; cargoByUnit: CargoUnitAggregate[]; relatedPurchaseInvoices: Array<{ id: string; documentType: string; documentSeries: string | null; documentNumber: string }>; expensesByCurrency: ExpenseCurrencyAggregate[] }
export interface ShipmentReconciliation { incoterm: ImportIncoterm | null; incotermNamedPlace: string | null; importShipmentLineId: string; importShipmentId: string; importOperationId: string; shipmentStatus: ImportShipmentStatus; productId: string | null; descriptionSnapshot: string; unitCode: string | null; purchaseInvoiceLineId: string | null; plannedQuantity: string; linkedQuantity: string; remainingQuantity: string; links: Array<{ importReceiptLinkId: string; purchaseReceiptLineId: string; purchaseReceiptId: string; receiptStatus: string; linkStatus: string; linkedQuantity: string }>; discrepancyCodes: string[] }
export interface ExpenseReconciliation { importExpenseId: string; importOperationId: string; category: ImportExpenseCategory; documentReference: string | null; supplierId: string | null; currencyCode: string; amount: string; status: ImportExpenseStatus; allocatedAmount: string; unallocatedAmount: string; attributedAmount: string; unattributedAmount: string; financialStatus: string | null }
export interface ConsolidatedReconciliation { importOperationId: string; reference: string; operationStatus: ImportOperationStatus; reconciliationStatus: 'CONSISTENT' | 'PARTIAL_PENDING_OPERATIONAL_LINK' | 'PENDING_ACCOUNTING_POLICY' | 'PENDING_FX' | 'DATA_INCONSISTENCY'; reasons: string[]; cargoByUnit: CargoUnitAggregate[]; expensesByCurrency: ExpenseCurrencyAggregate[]; discrepancyCodes: string[] }
