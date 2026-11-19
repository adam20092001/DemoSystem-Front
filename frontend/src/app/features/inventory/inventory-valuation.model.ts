export type InventoryValuationMethod = 'MOVING_WEIGHTED_AVERAGE' | 'FIFO';

export interface ValuedInventoryItem {
  productId: string;
  sku: string;
  name: string;
  method: InventoryValuationMethod;
  physicalStockCurrent: string;
  valuedQuantity: string;
  weightedAverageUnitCost: string;
  totalValue: string;
}

export interface PendingValuationItem {
  inventoryMovementId: string;
  productId: string;
  sku: string;
  name: string;
  purchaseReceiptId: string | null;
  quantity: string;
  createdAt: string;
}
