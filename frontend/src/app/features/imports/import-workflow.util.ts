import type { ImportOperation, ImportShipment } from './imports.model';

export function operationIsOpen(operation: Pick<ImportOperation, 'status'> | null): boolean {
  return !!operation && ['DRAFT', 'IN_PROGRESS'].includes(operation.status);
}
export function operationCanCancel(operation: Pick<ImportOperation, 'status'> | null, shipments: Pick<ImportShipment, 'status'>[]): boolean {
  return operationIsOpen(operation) && !shipments.some(shipment => shipment.status === 'ARRIVED');
}
export function shipmentActionAllowed(operation: Pick<ImportOperation, 'status'> | null, shipment: Pick<ImportShipment, 'status'>, action: 'edit' | 'depart' | 'arrive' | 'cancel'): boolean {
  if (!operationIsOpen(operation)) return false;
  return action === 'edit' || action === 'depart' ? shipment.status === 'PLANNED'
    : action === 'arrive' ? shipment.status === 'IN_TRANSIT'
    : ['PLANNED', 'IN_TRANSIT'].includes(shipment.status);
}
