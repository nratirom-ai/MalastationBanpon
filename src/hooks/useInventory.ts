import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Product, 
  DailyCountRecord, 
  UndoableAction, 
  StockAlert, 
  InventoryFilter, 
  ReorderItem,
  LineSyncSettings,
  SyncStatus
} from '../types/inventory';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_DAILY_COUNTS, 
  getTodayString 
} from '../data/initialData';
import { soundManager } from '../utils/soundAlert';
import { formatQty, parseQty } from '../utils/numberFormat';
import {
  subscribeToProducts,
  subscribeToDailyCounts,
  subscribeToLineSettings,
  saveProductToFirestore,
  batchSaveProductsToFirestore,
  deleteProductFromFirestore,
  saveDailyCountToFirestore,
  batchSaveDailyCountsToFirestore,
  saveLineSettingsToFirestore,
  recordStockLog
} from '../services/firebaseFirestore';
import {
  buildLineStockReport,
  sendLineNotify,
  openLineShare
} from '../services/lineService';

const PRODUCTS_STORAGE_KEY = 'daily_stock_products_v1';
const COUNTS_STORAGE_KEY = 'daily_stock_counts_v1';
const SOUND_SETTING_KEY = 'daily_stock_sound_enabled';
const LINE_SETTINGS_STORAGE_KEY = 'daily_stock_line_settings';

export function useInventory(
  currentCollaborator?: { email?: string | null; displayName?: string | null; uid?: string } | null
) {
  // Sync Status across Web Browser and Mobile Web App
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isFirestoreConnected: false,
    lastSyncedAt: null,
    syncError: null,
  });

  const [syncCounter, setSyncCounter] = useState(0);

  const refreshRealtimeSync = useCallback(() => {
    setSyncCounter((c) => c + 1);
  }, []);

  // LINE Settings
  const [lineSettings, setLineSettings] = useState<LineSyncSettings>(() => {
    try {
      const saved = localStorage.getItem(LINE_SETTINGS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load local line settings', e);
    }
    return {
      lineNotifyToken: '',
      webhookUrl: '',
      autoNotifyLowStock: true,
      notifyOnCountComplete: true,
    };
  });

  // Load products (cached initial fallback, then synced with Firestore real-time)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 50) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load products from storage', e);
    }
    return INITIAL_PRODUCTS;
  });

  // Load daily counts
  const [dailyCounts, setDailyCounts] = useState<DailyCountRecord[]>(() => {
    try {
      const saved = localStorage.getItem(COUNTS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load counts from storage', e);
    }
    return INITIAL_DAILY_COUNTS;
  });

  // Selected date for stock counting
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());

  // Undo stack
  const [undoStack, setUndoStack] = useState<UndoableAction[]>([]);
  const [lastUndoMessage, setLastUndoMessage] = useState<string | null>(null);

  // Sound alert enabled
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(SOUND_SETTING_KEY);
    return saved !== null ? saved === 'true' : true;
  });

  // Filters
  const [filters, setFilters] = useState<InventoryFilter>({
    searchQuery: '',
    category: 'ALL',
    supplier: 'ALL',
    location: 'ALL',
    status: 'ALL',
  });

  // Ref to prevent circular updates
  const isUpdatingFromRemoteRef = useRef(false);

  // REAL-TIME FIRESTORE SUBSCRIPTIONS: Synchronizes Web Browser, Web App, Mobile instantly!
  useEffect(() => {
    let unsubs: (() => void)[] = [];

    try {
      // 1. Subscribe to Products
      const unsubProducts = subscribeToProducts(
        (remoteProducts) => {
          isUpdatingFromRemoteRef.current = true;
          setProducts(remoteProducts);
          setSyncStatus((prev) => ({
            ...prev,
            isFirestoreConnected: true,
            lastSyncedAt: new Date(),
            syncError: null,
          }));
          isUpdatingFromRemoteRef.current = false;
        },
        (err) => {
          console.warn('Firestore products sync warning:', err);
          setSyncStatus((prev) => ({ ...prev, syncError: err.message }));
        }
      );
      unsubs.push(unsubProducts);

      // 2. Subscribe to Daily Counts
      const unsubCounts = subscribeToDailyCounts(
        (remoteCounts) => {
          isUpdatingFromRemoteRef.current = true;
          setDailyCounts(remoteCounts);
          setSyncStatus((prev) => ({
            ...prev,
            isFirestoreConnected: true,
            lastSyncedAt: new Date(),
          }));
          isUpdatingFromRemoteRef.current = false;
        },
        (err) => {
          console.warn('Firestore counts sync warning:', err);
        }
      );
      unsubs.push(unsubCounts);

      // 3. Subscribe to LINE Settings
      const unsubSettings = subscribeToLineSettings((remoteSettings) => {
        setLineSettings((prev) => ({ ...prev, ...remoteSettings }));
      });
      unsubs.push(unsubSettings);
    } catch (err: any) {
      console.warn('Firestore setup subscription error:', err);
      setSyncStatus((prev) => ({
        ...prev,
        isFirestoreConnected: false,
        syncError: err?.message || 'Offline mode',
      }));
    }

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch (e) {
          // ignore
        }
      });
    };
  }, [syncCounter, currentCollaborator?.email, currentCollaborator?.uid]);

  // Sync products to local storage
  useEffect(() => {
    try {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
    } catch (e) {
      console.error('Error saving products to localStorage', e);
    }
  }, [products]);

  // Sync counts to local storage
  useEffect(() => {
    try {
      localStorage.setItem(COUNTS_STORAGE_KEY, JSON.stringify(dailyCounts));
    } catch (e) {
      console.error('Error saving daily counts to localStorage', e);
    }
  }, [dailyCounts]);

  // Sync sound settings
  useEffect(() => {
    soundManager.enabled = soundEnabled;
    localStorage.setItem(SOUND_SETTING_KEY, String(soundEnabled));
  }, [soundEnabled]);

  // Sync LINE settings to local storage
  useEffect(() => {
    try {
      localStorage.setItem(LINE_SETTINGS_STORAGE_KEY, JSON.stringify(lineSettings));
    } catch (e) {
      console.error('Error saving line settings to localStorage', e);
    }
  }, [lineSettings]);

  // Map of [productId_date] -> count for fast O(1) lookup
  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const record of dailyCounts) {
      map.set(`${record.productId}_${record.date}`, record.quantity);
    }
    return map;
  }, [dailyCounts]);

  // Helper to get stock quantity on a specific date. When entering a new day, default starts at 0!
  const getProductStockOnDate = useCallback((productId: string, date: string): number => {
    const key = `${productId}_${date}`;
    if (countMap.has(key)) {
      return countMap.get(key)!;
    }
    // เมื่อขึ้นวันใหม่หรือยังไม่มีการบันทึกในวันนั้น ค่าสต็อกเริ่มต้นของวันจะเป็น 0 ทันที
    return 0;
  }, [countMap]);

  // Helper to get previous recorded stock before a given date (for comparison with yesterday)
  const getPreviousStockBeforeDate = useCallback((productId: string, date: string): number | null => {
    const productCounts = dailyCounts
      .filter((c) => c.productId === productId && c.date < date)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (productCounts.length > 0) {
      return productCounts[0].quantity;
    }
    return null;
  }, [dailyCounts]);

  // Distinct lists for filter dropdowns
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.supplier) set.add(p.supplier);
    });
    return Array.from(set).sort();
  }, [products]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.location) set.add(p.location);
    });
    return Array.from(set).sort();
  }, [products]);

  // Real-time stock alerts calculation for selectedDate
  const stockAlerts = useMemo((): StockAlert[] => {
    const alerts: StockAlert[] = [];
    for (const p of products) {
      const stock = getProductStockOnDate(p.id, selectedDate);
      if (stock !== null) {
        if (stock === 0) {
          alerts.push({
            id: `alert-${p.id}-out`,
            productId: p.id,
            productName: p.name,
            currentStock: 0,
            minStock: p.minStock,
            unit: p.unit,
            severity: 'out_of_stock',
            timestamp: new Date().toISOString(),
            read: false,
          });
        } else if (stock <= p.minStock * 0.5) {
          alerts.push({
            id: `alert-${p.id}-crit`,
            productId: p.id,
            productName: p.name,
            currentStock: stock,
            minStock: p.minStock,
            unit: p.unit,
            severity: 'critical',
            timestamp: new Date().toISOString(),
            read: false,
          });
        } else if (stock <= p.minStock) {
          alerts.push({
            id: `alert-${p.id}-warn`,
            productId: p.id,
            productName: p.name,
            currentStock: stock,
            minStock: p.minStock,
            unit: p.unit,
            severity: 'warning',
            timestamp: new Date().toISOString(),
            read: false,
          });
        }
      }
    }
    return alerts;
  }, [products, selectedDate, getProductStockOnDate]);

  // Reorder summary list (items <= minStock on selected date)
  const reorderItems = useMemo((): ReorderItem[] => {
    const items: ReorderItem[] = [];
    for (const p of products) {
      const stock = getProductStockOnDate(p.id, selectedDate) ?? 0;
      if (stock <= p.minStock) {
        const reorderQuantity = Math.max(0, Math.round((p.minStock - stock) * 100) / 100);
        const estimatedCost = Math.round(reorderQuantity * (p.unitCost || 0) * 100) / 100;
        let status: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' = 'LOW';
        if (stock === 0) {
          status = 'OUT_OF_STOCK';
        } else if (stock <= p.minStock * 0.5) {
          status = 'CRITICAL';
        }

        items.push({
          product: p,
          currentStock: stock,
          minStock: p.minStock,
          reorderQuantity,
          estimatedCost,
          status,
        });
      }
    }
    return items.sort((a, b) => {
      const order = { OUT_OF_STOCK: 0, CRITICAL: 1, LOW: 2 };
      return order[a.status] - order[b.status];
    });
  }, [products, selectedDate, getProductStockOnDate]);

  // Update stock count for a single product on a specific date (Syncs to Firestore & triggers real-time updates)
  const updateProductStock = useCallback((
    productId: string,
    newQuantity: number,
    date: string = selectedDate,
    actionDesc?: string
  ) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const previousCountRecord = dailyCounts.find(
      (c) => c.productId === productId && c.date === date
    );
    const prevQty = previousCountRecord ? previousCountRecord.quantity : null;
    const cleanQty = Math.max(0, Math.round(newQuantity * 100) / 100);

    const userIdentifier =
      currentCollaborator?.email ||
      currentCollaborator?.displayName ||
      'ผู้ใช้ออนไลน์';

    const record: DailyCountRecord = {
      productId,
      date,
      quantity: cleanQty,
      countedAt: new Date().toISOString(),
      countedBy: userIdentifier,
    };

    // Push to undo stack
    const undoAction: UndoableAction = {
      id: `undo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'COUNT_UPDATE',
      timestamp: Date.now(),
      description: actionDesc || `เปลี่ยนยอด "${product.name}" เป็น ${formatQty(cleanQty)} ${product.unit}`,
      payload: {
        productId,
        productName: product.name,
        date,
        previousState: prevQty,
        newState: cleanQty,
      },
    };

    setUndoStack((prev) => [undoAction, ...prev.slice(0, 30)]);
    setLastUndoMessage(`บันทึก ${product.name}: ${formatQty(cleanQty)} ${product.unit}`);

    // Update local state immediately (Optimistic update)
    setDailyCounts((prev) => {
      const filtered = prev.filter((c) => !(c.productId === productId && c.date === date));
      return [...filtered, record];
    });

    // Sync to Firestore in real-time
    saveDailyCountToFirestore(record).catch((err) => {
      console.warn('Firestore count sync error:', err);
    });

    recordStockLog('count', `อัปเดตสต็อก ${product.name}: ${formatQty(cleanQty)} ${product.unit} (โดย ${userIdentifier})`, {
      productId,
      productName: product.name,
      date
    });

    // Check alert threshold & play chime
    if (cleanQty <= 0) {
      soundManager.playCriticalChime();
    } else if (cleanQty <= product.minStock) {
      soundManager.playWarningChime();
    } else {
      soundManager.playSuccessChime();
    }
  }, [products, dailyCounts, selectedDate, currentCollaborator]);

  // Quick adjust (increment / decrement)
  const adjustProductStock = useCallback((
    productId: string,
    delta: number,
    date: string = selectedDate
  ) => {
    const current = getProductStockOnDate(productId, date) ?? 0;
    const nextQty = Math.max(0, Math.round((current + delta) * 100) / 100);
    const p = products.find((x) => x.id === productId);
    const pName = p ? p.name : 'สินค้า';
    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    updateProductStock(productId, nextQty, date, `ปรับยอด ${pName} (${sign}) เป็น ${formatQty(nextQty)}`);
  }, [getProductStockOnDate, products, selectedDate, updateProductStock]);

  // Revert / Undo the last action
  const undoLastAction = useCallback((): boolean => {
    if (undoStack.length === 0) return false;

    const [actionToUndo, ...remainingStack] = undoStack;
    setUndoStack(remainingStack);

    if (actionToUndo.type === 'COUNT_UPDATE') {
      const { productId, productName, date, previousState } = actionToUndo.payload;
      if (!date || !productId) return false;

      if (productId === 'all') {
        // Undo batch zero reset
        const prevRecords = previousState || [];
        setDailyCounts((prev) => {
          const withoutDate = prev.filter((c) => c.date !== date);
          return [...withoutDate, ...prevRecords];
        });
        batchSaveDailyCountsToFirestore(prevRecords).catch(console.warn);
        setLastUndoMessage(`ย้อนการรีเซ็ตสต็อกวันที่ ${date} สำเร็จ`);
        soundManager.playSuccessChime();
        return true;
      }

      setDailyCounts((prev) => {
        const withoutCurrent = prev.filter(
          (c) => !(c.productId === productId && c.date === date)
        );
        if (previousState === null || previousState === undefined) {
          return withoutCurrent;
        } else {
          return [
            ...withoutCurrent,
            {
              productId,
              date,
              quantity: previousState,
              countedAt: new Date().toISOString(),
            },
          ];
        }
      });

      if (previousState !== null && previousState !== undefined) {
        saveDailyCountToFirestore({
          productId,
          date,
          quantity: previousState,
          countedAt: new Date().toISOString(),
        }).catch(console.warn);
      }

      setLastUndoMessage(
        previousState !== null
          ? `ย้อนกลับยอด ${productName} คืนเป็น ${formatQty(previousState)}`
          : `ยกเลิกการนับสต็อก ${productName}`
      );
      soundManager.playSuccessChime();
      return true;
    }

    if (actionToUndo.type === 'PRODUCT_EDIT') {
      const { previousState } = actionToUndo.payload;
      if (previousState) {
        setProducts((prev) =>
          prev.map((p) => (p.id === previousState.id ? previousState : p))
        );
        saveProductToFirestore(previousState).catch(console.warn);
        setLastUndoMessage(`ย้อนการแก้ไขสินค้า: ${previousState.name}`);
        return true;
      }
    }

    if (actionToUndo.type === 'PRODUCT_ADD') {
      const { productId, productName } = actionToUndo.payload;
      if (productId) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        deleteProductFromFirestore(productId).catch(console.warn);
        setLastUndoMessage(`ย้อนการเพิ่มสินค้า: ลบ "${productName}" แล้ว`);
        return true;
      }
    }

    if (actionToUndo.type === 'PRODUCT_DELETE') {
      const { previousState } = actionToUndo.payload;
      if (previousState) {
        setProducts((prev) => [...prev, previousState]);
        saveProductToFirestore(previousState).catch(console.warn);
        setLastUndoMessage(`กู้คืนสินค้าที่ถูกลบ: "${previousState.name}"`);
        return true;
      }
    }

    if (actionToUndo.type === 'PRODUCT_REORDER') {
      const { previousState } = actionToUndo.payload;
      if (previousState && Array.isArray(previousState)) {
        setProducts(previousState);
        batchSaveProductsToFirestore(previousState).catch(console.warn);
        setLastUndoMessage('ย้อนการเปลี่ยนลำดับวัตถุดิบเรียบร้อย');
        soundManager.playSuccessChime();
        return true;
      }
    }

    return false;
  }, [undoStack]);

  // Product CRUD (Synchronized with Firestore)
  const addProduct = useCallback((productInput: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newId = `prod-${Date.now()}`;
    const newProduct: Product = {
      ...productInput,
      id: newId,
      order: products.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProducts((prev) => [newProduct, ...prev]);

    setUndoStack((prev) => [
      {
        id: `undo-${Date.now()}`,
        type: 'PRODUCT_ADD',
        timestamp: Date.now(),
        description: `เพิ่มสินค้าใหม่ "${newProduct.name}"`,
        payload: {
          productId: newId,
          productName: newProduct.name,
          newState: newProduct,
        },
      },
      ...prev,
    ]);

    setLastUndoMessage(`เพิ่มสินค้า "${newProduct.name}" เรียบร้อยแล้ว`);

    // Sync to Firestore
    saveProductToFirestore(newProduct).catch((err) => {
      console.warn('Failed to save new product to Firestore:', err);
    });
  }, [products.length]);

  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    const existing = products.find((p) => p.id === id);
    if (!existing) return;

    const updated: Product = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));

    setUndoStack((prev) => [
      {
        id: `undo-${Date.now()}`,
        type: 'PRODUCT_EDIT',
        timestamp: Date.now(),
        description: `แก้ไขข้อมูลสินค้า "${updated.name}"`,
        payload: {
          productId: id,
          productName: updated.name,
          previousState: existing,
          newState: updated,
        },
      },
      ...prev,
    ]);

    setLastUndoMessage(`บันทึกการแก้ไข "${updated.name}" เรียบร้อย`);

    // Sync to Firestore
    saveProductToFirestore(updated).catch((err) => {
      console.warn('Failed to update product in Firestore:', err);
    });
  }, [products]);

  const deleteProduct = useCallback((id: string) => {
    const existing = products.find((p) => p.id === id);
    if (!existing) return;

    setProducts((prev) => prev.filter((p) => p.id !== id));

    setUndoStack((prev) => [
      {
        id: `undo-${Date.now()}`,
        type: 'PRODUCT_DELETE',
        timestamp: Date.now(),
        description: `ลบสินค้า "${existing.name}"`,
        payload: {
          productId: id,
          productName: existing.name,
          previousState: existing,
        },
      },
      ...prev,
    ]);

    setLastUndoMessage(`ลบสินค้า "${existing.name}" เรียบร้อย`);

    // Delete from Firestore
    deleteProductFromFirestore(id).catch((err) => {
      console.warn('Failed to delete product from Firestore:', err);
    });
  }, [products]);

  // Reset all stock counts of a date to 0 (Synchronized to Firestore)
  const resetDayStockToZero = useCallback((date: string = selectedDate) => {
    const existingDateRecords = dailyCounts.filter((c) => c.date === date);

    const zeroRecords: DailyCountRecord[] = products.map((p) => ({
      productId: p.id,
      date,
      quantity: 0,
      countedAt: new Date().toISOString(),
    }));

    setUndoStack((prev) => [
      {
        id: `undo-${Date.now()}`,
        type: 'COUNT_UPDATE',
        timestamp: Date.now(),
        description: `รีเซ็ตยอดสต็อกวันที่ ${date} เป็น 0 ทั้งหมด`,
        payload: {
          productId: 'all',
          productName: 'ทุกรายการ',
          date,
          previousState: existingDateRecords,
          newState: zeroRecords,
        },
      },
      ...prev,
    ]);

    setDailyCounts((prev) => {
      const withoutDate = prev.filter((c) => c.date !== date);
      return [...withoutDate, ...zeroRecords];
    });

    batchSaveDailyCountsToFirestore(zeroRecords).catch((err) => {
      console.warn('Failed to batch save zero counts to Firestore:', err);
    });

    setLastUndoMessage(`รีเซ็ตสต็อกวันที่ ${date} เป็น 0.00 ทั้งหมดแล้ว`);
    soundManager.playSuccessChime();
  }, [products, dailyCounts, selectedDate]);

  // Move product up or down by 1 step in sequence (Syncs order across devices)
  const moveProduct = useCallback((productId: string, direction: 'up' | 'down') => {
    setProducts((prev) => {
      const index = prev.findIndex((p) => p.id === productId);
      if (index === -1) return prev;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const newProducts = [...prev];
      const [item] = newProducts.splice(index, 1);
      newProducts.splice(targetIndex, 0, item);

      // Reassign explicit order numbers
      const orderedProducts = newProducts.map((p, idx) => ({ ...p, order: idx + 1 }));

      const dirText = direction === 'up' ? 'ขึ้น' : 'ลง';
      setUndoStack((stack) => [
        {
          id: `undo-${Date.now()}`,
          type: 'PRODUCT_REORDER',
          timestamp: Date.now(),
          description: `ย้ายลำดับ "${item.name}" ${dirText} (ตำแหน่งที่ ${targetIndex + 1})`,
          payload: {
            productId: item.id,
            productName: item.name,
            previousState: prev,
            newState: orderedProducts,
          },
        },
        ...stack,
      ]);

      setLastUndoMessage(`ย้ายลำดับ "${item.name}" ${dirText} สำเร็จ`);
      soundManager.playSuccessChime();

      batchSaveProductsToFirestore(orderedProducts).catch(console.warn);

      return orderedProducts;
    });
  }, []);

  // Move product directly to a specific target index (0-based)
  const moveProductToIndex = useCallback((productId: string, targetIndex: number) => {
    setProducts((prev) => {
      const currentIndex = prev.findIndex((p) => p.id === productId);
      if (currentIndex === -1) return prev;
      const validIndex = Math.max(0, Math.min(prev.length - 1, targetIndex));
      if (currentIndex === validIndex) return prev;

      const newProducts = [...prev];
      const [item] = newProducts.splice(currentIndex, 1);
      newProducts.splice(validIndex, 0, item);

      const orderedProducts = newProducts.map((p, idx) => ({ ...p, order: idx + 1 }));

      setUndoStack((stack) => [
        {
          id: `undo-${Date.now()}`,
          type: 'PRODUCT_REORDER',
          timestamp: Date.now(),
          description: `ย้ายลำดับ "${item.name}" ไปที่ลำดับ #${validIndex + 1}`,
          payload: {
            productId: item.id,
            productName: item.name,
            previousState: prev,
            newState: orderedProducts,
          },
        },
        ...stack,
      ]);

      setLastUndoMessage(`ย้าย "${item.name}" ไปลำดับ #${validIndex + 1} แล้ว`);
      soundManager.playSuccessChime();

      batchSaveProductsToFirestore(orderedProducts).catch(console.warn);

      return orderedProducts;
    });
  }, []);

  // Replace whole product sequence or drag-and-drop array
  const reorderProducts = useCallback((newProducts: Product[], reason: string = 'เปลี่ยนลำดับวัตถุดิบทั้งหมด') => {
    setProducts((prev) => {
      const orderedProducts = newProducts.map((p, idx) => ({ ...p, order: idx + 1 }));

      setUndoStack((stack) => [
        {
          id: `undo-${Date.now()}`,
          type: 'PRODUCT_REORDER',
          timestamp: Date.now(),
          description: reason,
          payload: {
            previousState: prev,
            newState: orderedProducts,
          },
        },
        ...stack,
      ]);
      setLastUndoMessage(`${reason} เรียบร้อย`);
      soundManager.playSuccessChime();

      batchSaveProductsToFirestore(orderedProducts).catch(console.warn);

      return orderedProducts;
    });
  }, []);

  // Fast preset sorting
  const sortProductsBy = useCallback((criteria: 'name' | 'category' | 'location' | 'supplier' | 'sku') => {
    const titles: Record<string, string> = {
      name: 'ตามชื่อสินค้า (ก-ฮ / A-Z)',
      category: 'ตามหมวดหมู่',
      location: 'ตามที่อยู่จัดเก็บ (Location)',
      supplier: 'ตามผู้จำหน่าย (Supplier)',
      sku: 'ตามรหัส SKU',
    };

    setProducts((prev) => {
      const sorted = [...prev].sort((a, b) => {
        const valA = (a[criteria] || '').toString();
        const valB = (b[criteria] || '').toString();
        return valA.localeCompare(valB, 'th');
      });

      const orderedProducts = sorted.map((p, idx) => ({ ...p, order: idx + 1 }));
      const desc = `จัดเรียง${titles[criteria] || criteria}`;

      setUndoStack((stack) => [
        {
          id: `undo-${Date.now()}`,
          type: 'PRODUCT_REORDER',
          timestamp: Date.now(),
          description: desc,
          payload: {
            previousState: prev,
            newState: orderedProducts,
          },
        },
        ...stack,
      ]);
      setLastUndoMessage(`${desc} เรียบร้อย`);
      soundManager.playSuccessChime();

      batchSaveProductsToFirestore(orderedProducts).catch(console.warn);

      return orderedProducts;
    });
  }, []);

  // Reset to initial sample data
  const resetToSampleData = useCallback(() => {
    setProducts(INITIAL_PRODUCTS);
    setDailyCounts(INITIAL_DAILY_COUNTS);
    setUndoStack([]);
    setLastUndoMessage('รีเซ็ตข้อมูลเป็นตัวอย่างเริ่มต้นแล้ว');

    batchSaveProductsToFirestore(INITIAL_PRODUCTS).catch(console.warn);
    batchSaveDailyCountsToFirestore(INITIAL_DAILY_COUNTS).catch(console.warn);
  }, []);

  // Update LINE synchronization settings
  const updateLineSettings = useCallback(async (newSettings: Partial<LineSyncSettings>) => {
    setLineSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveLineSettingsToFirestore(updated).catch(console.warn);
      return updated;
    });
  }, []);

  // Dispatch daily stock count report directly to LINE
  const sendStockSummaryToLine = useCallback(async (targetDate: string = selectedDate) => {
    const totalProducts = products.length;
    let countedCount = 0;
    let normalCount = 0;
    let outOfStockCount = 0;
    let criticalCount = 0;

    for (const p of products) {
      const stock = getProductStockOnDate(p.id, targetDate);
      if (stock > 0) countedCount++;
      if (stock === 0) outOfStockCount++;
      else if (stock <= p.minStock * 0.5) criticalCount++;
      else if (stock > p.minStock) normalCount++;
    }

    const message = buildLineStockReport({
      date: targetDate,
      totalProducts,
      countedCount,
      reorderItems,
      normalCount,
      outOfStockCount,
      criticalCount,
    });

    const tokenOrWebhook = lineSettings.lineNotifyToken || lineSettings.webhookUrl;
    if (tokenOrWebhook) {
      return await sendLineNotify(tokenOrWebhook, message);
    } else {
      // Direct LINE App share
      openLineShare(message);
      return {
        success: true,
        message: 'เปิด LINE เพื่อแชร์รายงานสต็อกเรียบร้อยแล้ว',
      };
    }
  }, [products, selectedDate, reorderItems, lineSettings, getProductStockOnDate]);

  return {
    products,
    dailyCounts,
    selectedDate,
    setSelectedDate,
    filters,
    setFilters,
    categories,
    suppliers,
    locations,
    stockAlerts,
    reorderItems,
    undoStack,
    lastUndoMessage,
    soundEnabled,
    setSoundEnabled,
    syncStatus,
    lineSettings,
    updateLineSettings,
    sendStockSummaryToLine,
    getProductStockOnDate,
    getPreviousStockBeforeDate,
    updateProductStock,
    adjustProductStock,
    resetDayStockToZero,
    undoLastAction,
    addProduct,
    updateProduct,
    deleteProduct,
    moveProduct,
    moveProductToIndex,
    reorderProducts,
    sortProductsBy,
    resetToSampleData,
    refreshRealtimeSync,
  };
}
