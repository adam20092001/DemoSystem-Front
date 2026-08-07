export type InventoryMovementType =
  | 'ENTRY'
  | 'EXIT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT';

export type InventoryMovementOrigin =
  | 'MANUAL'
  | 'INITIAL_BALANCE'
  | 'SALE'
  | 'SALE_CANCELLATION'
  | 'OTHER';

export type InventoryOperation = 'INITIAL_BALANCE' | InventoryMovementType;

export interface InventoryMovementProduct {
  id: string;
  sku: string;
  name: string;
}

export interface InventoryMovementCreatedBy {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
}

export interface InventoryMovement {
  id: string;
  product: InventoryMovementProduct;
  movementType: InventoryMovementType;
  origin: InventoryMovementOrigin;
  quantity: string;
  previousStock: string;
  newStock: string;
  reason: string;
  notes: string | null;
  createdBy: InventoryMovementCreatedBy;
  createdAt: string;
}

export interface ProductStock {
  productId: string;
  sku: string;
  name: string;
  stockCurrent: string;
  stockMinimum: string;
  unitAbbreviation: string;
  allowDecimal: boolean;
}

export interface LowStockItem {
  id: string;
  sku: string;
  name: string;
  stockCurrent: string;
  stockMinimum: string;
  category: {
    id: string;
    name: string;
  };
  unit: {
    id: string;
    abbreviation: string;
  };
}

export interface ListMovementsQuery {
  page: number;
  limit: number;
  productId?: string;
  movementType?: InventoryMovementType;
  origin?: InventoryMovementOrigin;
  createdByUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface ListLowStockQuery {
  page: number;
  limit: number;
  categoryId?: string;
  unitId?: string;
  search?: string;
}

export interface RegisterInventoryMovementRequest {
  productId: string;
  quantity: string;
  reason: string;
  notes?: string;
}
