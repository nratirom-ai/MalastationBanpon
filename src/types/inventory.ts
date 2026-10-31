export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  supplier: string;
  location: string;
  unit: string;
  minStock: number;
  unitCost: number;
  order?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyCountRecord {
  productId: string;
  date: string; // YYYY-MM-DD
  quantity: number;
  countedAt: string;
  countedBy?: string;
  notes?: string;
}

export interface StockChangeLog {
  id: string;
  timestamp: string;
  date: string; // Target counting date
  productId: string;
  productName: string;
  previousQuantity: number | null;
  newQuantity: number;
  reason?: string;
}

export interface UndoableAction {
  id: string;
  type: 'COUNT_UPDATE' | 'PRODUCT_EDIT' | 'PRODUCT_ADD' | 'PRODUCT_DELETE' | 'PRODUCT_REORDER';
  timestamp: number;
  description: string;
  payload: {
    productId?: string;
    productName?: string;
    date?: string;
    previousState?: any;
    newState?: any;
  };
}

export interface ReorderItem {
  product: Product;
  currentStock: number;
  minStock: number;
  reorderQuantity: number;
  estimatedCost: number;
  status: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW';
}

export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  minStock: number;
  unit: string;
  severity: 'out_of_stock' | 'critical' | 'warning';
  timestamp: string;
  read: boolean;
}

export interface InventoryFilter {
  searchQuery: string;
  category: string;
  supplier: string;
  location: string;
  status: 'ALL' | 'BELOW_MIN' | 'OUT_OF_STOCK' | 'NORMAL' | 'COUNTED' | 'UNCOUNTED';
}

export type ReportPeriod = 'daily' | 'monthly' | 'yearly';

export interface LineSyncSettings {
  lineNotifyToken?: string;
  webhookUrl?: string;
  autoNotifyLowStock?: boolean;
  notifyOnCountComplete?: boolean;
  lastSyncTimestamp?: string;
}

export interface SyncStatus {
  isFirestoreConnected: boolean;
  lastSyncedAt: Date | null;
  syncError: string | null;
}

export interface UserPresence {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  lastActive: string; // ISO string
  status: 'online' | 'idle' | 'editing';
  currentDate?: string;
  currentTab?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  editingProductId?: string;
}
