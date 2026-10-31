import React, { useState, useMemo } from 'react';
import { 
  Product, 
  InventoryFilter, 
  DailyCountRecord 
} from '../types/inventory';
import { 
  Search, 
  Filter, 
  MapPin, 
  Truck, 
  Tag, 
  AlertTriangle, 
  AlertOctagon, 
  CheckCircle2, 
  Minus, 
  Plus, 
  RotateCcw, 
  Sparkles, 
  HelpCircle,
  Edit2,
  Trash2,
  RefreshCw,
  Package,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  MessageCircle,
  Users
} from 'lucide-react';
import { getOffsetDateString } from '../data/initialData';
import { formatQty, parseQty } from '../utils/numberFormat';

interface StockCounterProps {
  products: Product[];
  dailyCounts: DailyCountRecord[];
  selectedDate: string;
  filters: InventoryFilter;
  setFilters: React.Dispatch<React.SetStateAction<InventoryFilter>>;
  categories: string[];
  suppliers: string[];
  locations: string[];
  getProductStockOnDate: (productId: string, date: string) => number;
  getPreviousStockBeforeDate?: (productId: string, date: string) => number | null;
  onUpdateStock: (productId: string, newQty: number, date?: string) => void;
  onAdjustStock: (productId: string, delta: number, date?: string) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onAddNewProduct: () => void;
  onResetDayStockToZero?: (date: string) => void;
  onMoveProduct?: (productId: string, direction: 'up' | 'down') => void;
  onOpenReorderModal?: () => void;
  onOpenLineSync?: () => void;
  onUndo: () => void;
  undoCount: number;
  lastUndoMessage: string | null;
  onOpenCollaborators?: () => void;
  collaboratorsCount?: number;
  userEmail?: string | null;
  onRefreshSync?: () => void;
  isFirestoreConnected?: boolean;
}

export const StockCounter: React.FC<StockCounterProps> = ({
  products,
  dailyCounts,
  selectedDate,
  filters,
  setFilters,
  categories,
  suppliers,
  locations,
  getProductStockOnDate,
  getPreviousStockBeforeDate,
  onUpdateStock,
  onAdjustStock,
  onEditProduct,
  onDeleteProduct,
  onAddNewProduct,
  onResetDayStockToZero,
  onMoveProduct,
  onOpenReorderModal,
  onOpenLineSync,
  onUndo,
  undoCount,
  lastUndoMessage,
  onOpenCollaborators,
  collaboratorsCount = 1,
  userEmail,
  onRefreshSync,
  isFirestoreConnected = true,
}) => {
  // Local input edit states for smooth typing
  const [editingInputs, setEditingInputs] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Compute yesterday's date
  const prevDate = useMemo(() => {
    try {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    } catch {
      return getOffsetDateString(-1);
    }
  }, [selectedDate]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // 1. Search Query (Name or SKU)
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase().trim();
        const matchName = product.name.toLowerCase().includes(query);
        const matchSku = product.sku.toLowerCase().includes(query);
        const matchNotes = product.notes?.toLowerCase().includes(query) ?? false;
        if (!matchName && !matchSku && !matchNotes) return false;
      }

      // 2. Category filter
      if (filters.category !== 'ALL' && product.category !== filters.category) {
        return false;
      }

      // 3. Supplier filter
      if (filters.supplier !== 'ALL' && product.supplier !== filters.supplier) {
        return false;
      }

      // 4. Location filter
      if (filters.location !== 'ALL' && product.location !== filters.location) {
        return false;
      }

      // 5. Stock Status filter
      const currentStock = getProductStockOnDate(product.id, selectedDate);
      const isCountedToday = dailyCounts.some(
        (c) => c.productId === product.id && c.date === selectedDate
      );

      if (filters.status === 'BELOW_MIN') {
        return currentStock !== null && currentStock <= product.minStock;
      }
      if (filters.status === 'OUT_OF_STOCK') {
        return currentStock !== null && currentStock === 0;
      }
      if (filters.status === 'NORMAL') {
        return currentStock !== null && currentStock > product.minStock;
      }
      if (filters.status === 'COUNTED') {
        return isCountedToday;
      }
      if (filters.status === 'UNCOUNTED') {
        return !isCountedToday;
      }

      return true;
    });
  }, [products, filters, selectedDate, dailyCounts, getProductStockOnDate]);

  // Overall counters
  const stats = useMemo(() => {
    let countedToday = 0;
    let belowMin = 0;
    let outOfStock = 0;
    let totalReorderQty = 0;

    for (const p of products) {
      const stock = getProductStockOnDate(p.id, selectedDate);
      const isCounted = dailyCounts.some(
        (c) => c.productId === p.id && c.date === selectedDate
      );
      if (isCounted) countedToday++;

      if (stock !== null) {
        if (stock === 0) outOfStock++;
        if (stock <= p.minStock) {
          belowMin++;
          totalReorderQty += Math.max(0, p.minStock - stock);
        }
      }
    }

    return {
      total: products.length,
      countedToday,
      belowMin,
      outOfStock,
      totalReorderQty,
    };
  }, [products, selectedDate, dailyCounts, getProductStockOnDate]);

  const handleInputChange = (productId: string, val: string) => {
    setEditingInputs((prev) => ({ ...prev, [productId]: val }));
  };

  const handleInputBlur = (productId: string) => {
    const rawVal = editingInputs[productId];
    if (rawVal !== undefined && rawVal !== '') {
      const parsed = parseFloat(rawVal);
      if (!isNaN(parsed) && parsed >= 0) {
        onUpdateStock(productId, parseQty(parsed), selectedDate);
      }
    }
    // Clean up local editing state
    setEditingInputs((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, productId: string) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      category: 'ALL',
      supplier: 'ALL',
      location: 'ALL',
      status: 'ALL',
    });
  };

  const hasActiveFilters =
    filters.searchQuery !== '' ||
    filters.category !== 'ALL' ||
    filters.supplier !== 'ALL' ||
    filters.location !== 'ALL' ||
    filters.status !== 'ALL';

  return (
    <div className="space-y-4">
      {/* Real-time Collaborative Banner */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div className="flex items-center flex-wrap gap-2">
            <span className="font-bold text-slate-800">
              ระบบออนไลน์เรียลไทม์
            </span>
            {userEmail ? (
              <span className="text-emerald-800 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300 text-[11px] flex items-center gap-1">
                <span>ล็อกอิน:</span>
                <span className="font-mono">{userEmail}</span>
              </span>
            ) : (
              <span className="text-slate-600 hidden sm:inline">
                • ทุกคนสามารถนับสต็อก บันทึกยอด และแก้ไขสินค้าพร้อมกันได้แบบเรียลไทม์
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshSync && (
            <button
              type="button"
              onClick={onRefreshSync}
              className="flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 rounded-lg font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer"
              title="ดึงข้อมูลล่าสุดจาก Cloud Firestore ทันที"
            >
              <RefreshCw className="w-3 h-3 text-emerald-600" />
              <span>ซิงค์ทันที</span>
            </button>
          )}

          {onOpenCollaborators && (
            <button
              type="button"
              onClick={onOpenCollaborators}
              className="flex items-center space-x-1.5 px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>กำลังออนไลน์ ({collaboratorsCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">สินค้าทั้งหมด</div>
            <div className="text-xl font-bold text-slate-900">{stats.total} รายการ</div>
            <div className="text-[11px] text-slate-400">ในระบบคลังสินค้า</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">นับเสร็จแล้ววันนี้</div>
            <div className="text-xl font-bold text-blue-900">
              {stats.countedToday} / {stats.total}
            </div>
            <div className="text-[11px] text-blue-600 font-medium">
              {stats.total > 0
                ? `${Math.round((stats.countedToday / stats.total) * 100)}% บันทึกแล้ว`
                : '0%'}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="p-3 bg-rose-50 text-rose-700 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-rose-600">ถึงเกณฑ์ขั้นต่ำ / ต้องสั่ง</div>
            <div className="text-xl font-bold text-rose-800">{stats.belowMin} รายการ</div>
            <div className="text-[11px] text-rose-500">
              {stats.outOfStock > 0 ? `หมดสต็อก ${stats.outOfStock} รายการ` : 'สต็อกใกล้หมด'}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-amber-700">ต้องสั่งเพิ่มรวม</div>
            <div className="text-xl font-bold text-amber-900">
              +{formatQty(stats.totalReorderQty)} หน่วย
            </div>
            <div className="text-[11px] text-amber-600">เพื่อให้ครบเกณฑ์ขั้นต่ำ</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => setFilters((f) => ({ ...f, searchQuery: e.target.value }))}
              placeholder="ค้นหาชื่อสินค้า, รหัส SKU, หรือรายละเอียด..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
            {filters.searchQuery && (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, searchQuery: '' }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            {onOpenReorderModal && (
              <button
                type="button"
                onClick={onOpenReorderModal}
                className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs sm:text-sm font-semibold rounded-lg border border-slate-200 shadow-2xs transition-colors"
                title="เปลี่ยนลำดับวัตถุดิบและสินค้าตามที่ต้องการ"
              >
                <ArrowUpDown className="w-4 h-4 text-emerald-600" />
                <span>จัดลำดับวัตถุดิบ</span>
              </button>
            )}

            {onResetDayStockToZero && (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-lg border border-slate-200 transition-colors"
                title={`รีเซ็ตยอดคงเหลือของวันที่ ${selectedDate} เป็น 0.00 ทั้งหมด`}
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <span>รีเซ็ตยอดวันนี้เป็น 0</span>
              </button>
            )}

            {onOpenLineSync && (
              <button
                type="button"
                onClick={onOpenLineSync}
                className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-[#06C755]/10 hover:bg-[#06C755]/20 text-[#05a847] text-xs sm:text-sm font-semibold rounded-lg border border-[#06C755]/30 transition-colors shadow-2xs"
                title="ซิงค์และแชร์ยอดสต็อกเข้ากลุ่ม LINE"
              >
                <MessageCircle className="w-4 h-4 text-[#06C755]" />
                <span>ส่งเข้า LINE</span>
              </button>
            )}

            {/* Add Product Button */}
            <button
              type="button"
              onClick={onAddNewProduct}
              className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มรายการสินค้าใหม่</span>
            </button>
          </div>
        </div>

        {/* Multi-Filters: Supplier, Location, Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {/* Supplier Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Truck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <label className="text-slate-500 shrink-0 font-medium">ผู้จำหน่าย:</label>
            <select
              value={filters.supplier}
              onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value }))}
              className="bg-transparent text-slate-800 font-semibold focus:outline-hidden w-full truncate cursor-pointer"
            >
              <option value="ALL">ผู้จำหน่ายทั้งหมด ({suppliers.length})</option>
              {suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Location / Zone Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <label className="text-slate-500 shrink-0 font-medium">ที่อยู่/โซน:</label>
            <select
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
              className="bg-transparent text-slate-800 font-semibold focus:outline-hidden w-full truncate cursor-pointer"
            >
              <option value="ALL">ที่อยู่/โซนทั้งหมด ({locations.length})</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Tag className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <label className="text-slate-500 shrink-0 font-medium">ประเภท:</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              className="bg-transparent text-slate-800 font-semibold focus:outline-hidden w-full truncate cursor-pointer"
            >
              <option value="ALL">ประเภททั้งหมด ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <label className="text-slate-500 shrink-0 font-medium">สถานะ:</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as any }))}
              className="bg-transparent text-slate-800 font-semibold focus:outline-hidden w-full truncate cursor-pointer"
            >
              <option value="ALL">ทุกสถานะ</option>
              <option value="BELOW_MIN">⚠️ ต่ำกว่าเกณฑ์ขั้นต่ำ</option>
              <option value="OUT_OF_STOCK">🚨 สินค้าหมดสต็อก (0)</option>
              <option value="NORMAL">✅ ปริมาณปกติ</option>
              <option value="COUNTED">📝 นับแล้ววันนี้</option>
              <option value="UNCOUNTED">⏳ ยังไม่ได้นับวันนี้</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips & Reset */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
            <div className="text-slate-500">
              พบ <span className="font-bold text-slate-800">{filteredProducts.length}</span> รายการ
              จาก {products.length} รายการ
            </div>
            <button
              onClick={resetFilters}
              className="text-emerald-700 hover:text-emerald-900 font-medium hover:underline text-xs"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        )}
      </div>

      {/* Stock Counting Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table header */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-3 px-5 py-3 bg-slate-50/90 border-b border-slate-200 text-xs font-semibold text-slate-600">
          <div className="col-span-4">สินค้า / รหัส SKU / หมวดหมู่</div>
          <div className="col-span-3">ที่อยู่จัดเก็บ &amp; ผู้จำหน่าย</div>
          <div className="col-span-1 text-center">เกณฑ์ขั้นต่ำ</div>
          <div className="col-span-1 text-center">เมื่อวาน</div>
          <div className="col-span-2 text-center">ยอดคงเหลือวันนี้ ({selectedDate})</div>
          <div className="col-span-1 text-right">จัดการ</div>
        </div>

        {/* Table body */}
        <div className="divide-y divide-slate-100">
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">ไม่พบรายการสินค้าที่ตรงกับเงื่อนไข</p>
              <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองด้านบน</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const currentStock = getProductStockOnDate(product.id, selectedDate);
              const yesterdayStock = getPreviousStockBeforeDate
                ? getPreviousStockBeforeDate(product.id, selectedDate)
                : getProductStockOnDate(product.id, prevDate);
              const isCountedToday = dailyCounts.some(
                (c) => c.productId === product.id && c.date === selectedDate
              );

              const productIndex = products.findIndex((p) => p.id === product.id);
              const isFirstInList = productIndex <= 0;
              const isLastInList = productIndex === products.length - 1;

              const inputValue =
                editingInputs[product.id] !== undefined
                  ? editingInputs[product.id]
                  : currentStock !== null
                  ? String(currentStock)
                  : '';

              const isOutOfStock = currentStock !== null && currentStock === 0;
              const isBelowMin = currentStock !== null && currentStock <= product.minStock;
              const reorderQty =
                currentStock !== null ? Math.max(0, product.minStock - currentStock) : 0;

              // Diff from yesterday
              const stockDiff =
                currentStock !== null && yesterdayStock !== null
                  ? currentStock - yesterdayStock
                  : null;

              return (
                <div
                  key={product.id}
                  className={`p-4 lg:px-5 lg:py-3.5 transition-colors ${
                    isOutOfStock
                      ? 'bg-rose-50/40 hover:bg-rose-50/70'
                      : isBelowMin
                      ? 'bg-amber-50/30 hover:bg-amber-50/60'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Desktop Grid Layout */}
                  <div className="hidden lg:grid lg:grid-cols-12 gap-3 items-center">
                    {/* Column 1: Product info & Reorder buttons */}
                    <div className="col-span-4 flex items-center space-x-2.5">
                      {onMoveProduct && (
                        <div className="flex flex-col items-center -space-y-1 shrink-0 bg-slate-50 border border-slate-200 rounded px-1 py-0.5">
                          <button
                            type="button"
                            disabled={isFirstInList}
                            onClick={() => onMoveProduct(product.id, 'up')}
                            className={`p-0.5 rounded transition-colors ${
                              isFirstInList
                                ? 'text-slate-300 cursor-not-allowed opacity-40'
                                : 'text-slate-500 hover:text-emerald-700 hover:bg-slate-200 active:scale-95'
                            }`}
                            title="เลื่อนวัตถุดิบขึ้น 1 ลำดับ"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-mono font-bold text-slate-500 leading-tight">
                            #{productIndex + 1}
                          </span>
                          <button
                            type="button"
                            disabled={isLastInList}
                            onClick={() => onMoveProduct(product.id, 'down')}
                            className={`p-0.5 rounded transition-colors ${
                              isLastInList
                                ? 'text-slate-300 cursor-not-allowed opacity-40'
                                : 'text-slate-500 hover:text-emerald-700 hover:bg-slate-200 active:scale-95'
                            }`}
                            title="เลื่อนวัตถุดิบลง 1 ลำดับ"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-900 text-sm truncate">
                            {product.name}
                          </span>
                          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                            {product.sku}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-slate-500">
                          <span className="inline-block bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full text-[11px] font-medium border border-teal-100 shrink-0">
                            {product.category}
                          </span>
                          {product.notes && (
                            <span className="text-slate-400 text-[11px] truncate max-w-xs" title={product.notes}>
                              • {product.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Location & Supplier */}
                    <div className="col-span-3 space-y-1 text-xs">
                      <div className="flex items-center space-x-1.5 text-slate-700 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{product.location}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-500">
                        <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{product.supplier}</span>
                      </div>
                    </div>

                    {/* Column 3: Min threshold */}
                    <div className="col-span-1 text-center">
                      <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 font-semibold rounded text-xs">
                        {formatQty(product.minStock)} {product.unit}
                      </span>
                    </div>

                    {/* Column 4: Yesterday count & diff */}
                    <div className="col-span-1 text-center text-xs">
                      <div className="font-medium text-slate-600">
                        {yesterdayStock !== null ? `${formatQty(yesterdayStock)} ${product.unit}` : '-'}
                      </div>
                      {stockDiff !== null && stockDiff !== 0 && (
                        <div
                          className={`text-[10px] font-semibold flex items-center justify-center ${
                            stockDiff > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {stockDiff > 0 ? (
                            <>
                              <ArrowUpRight className="w-3 h-3" />+{stockDiff > 0 ? stockDiff.toFixed(2) : stockDiff}
                            </>
                          ) : (
                            <>
                              <ArrowDownRight className="w-3 h-3" />
                              {stockDiff.toFixed(2)}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Column 5: Stock Counter input & quick steppers */}
                    <div className="col-span-2 flex flex-col items-center space-y-1.5">
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => onAdjustStock(product.id, -1, selectedDate)}
                          className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs transition-colors active:scale-95 border border-slate-200"
                          title="-1"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={inputValue}
                            onChange={(e) => handleInputChange(product.id, e.target.value)}
                            onBlur={() => handleInputBlur(product.id)}
                            onKeyDown={(e) => handleKeyDown(e, product.id)}
                            placeholder="0.00"
                            className={`w-24 text-center font-bold text-sm py-1 border rounded-lg focus:outline-hidden focus:ring-2 transition-all ${
                              isOutOfStock
                                ? 'bg-red-50 border-red-300 text-red-900 focus:ring-red-300'
                                : isBelowMin
                                ? 'bg-amber-50 border-amber-300 text-amber-900 focus:ring-amber-300'
                                : isCountedToday
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 focus:ring-emerald-300'
                                : 'bg-white border-slate-300 text-slate-900 focus:ring-slate-200'
                            }`}
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-normal pointer-events-none">
                            {product.unit}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onAdjustStock(product.id, +1, selectedDate)}
                          className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs transition-colors active:scale-95 border border-slate-200"
                          title="+1"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Quick shortcut steppers (-0.5, +0.5, -5, +5) & status badge */}
                      <div className="flex items-center space-x-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => onAdjustStock(product.id, -0.5, selectedDate)}
                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                          title="-0.5"
                        >
                          -0.5
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustStock(product.id, +0.5, selectedDate)}
                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                          title="+0.5"
                        >
                          +0.5
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustStock(product.id, +5, selectedDate)}
                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                          title="+5"
                        >
                          +5
                        </button>

                        {isOutOfStock ? (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold">
                            หมด! สั่ง +{formatQty(reorderQty)}
                          </span>
                        ) : isBelowMin ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                            สั่ง +{formatQty(reorderQty)}
                          </span>
                        ) : isCountedToday ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                            บันทึกแล้ว
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                            ยังไม่นับ
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Column 6: Actions */}
                    <div className="col-span-1 flex items-center justify-end space-x-1">
                      <button
                        type="button"
                        onClick={() => onEditProduct(product)}
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="แก้ไขชื่อสินค้า / หน่วย / ข้อมูล"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {confirmDeleteId === product.id ? (
                        <div className="flex items-center space-x-1 animate-fadeIn">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteProduct(product.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded shadow-xs"
                            title="ยืนยันการลบรายการสินค้านี้"
                          >
                            ลบ
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] rounded"
                            title="ยกเลิก"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(product.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบรายการสินค้านี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile Card Layout (< lg screens) */}
                  <div className="lg:hidden space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2">
                        {onMoveProduct && (
                          <div className="flex items-center space-x-0.5 bg-slate-100 rounded-md p-0.5 border border-slate-200 shrink-0 mt-0.5">
                            <button
                              type="button"
                              disabled={isFirstInList}
                              onClick={() => onMoveProduct(product.id, 'up')}
                              className={`p-1 rounded transition-colors ${
                                isFirstInList
                                  ? 'text-slate-300 cursor-not-allowed opacity-40'
                                  : 'text-slate-600 hover:text-emerald-700 active:scale-95'
                              }`}
                              title="ย้ายขึ้น"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] font-bold text-slate-600 font-mono px-0.5">
                              #{productIndex + 1}
                            </span>
                            <button
                              type="button"
                              disabled={isLastInList}
                              onClick={() => onMoveProduct(product.id, 'down')}
                              className={`p-1 rounded transition-colors ${
                                isLastInList
                                  ? 'text-slate-300 cursor-not-allowed opacity-40'
                                  : 'text-slate-600 hover:text-emerald-700 active:scale-95'
                              }`}
                              title="ย้ายลง"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-slate-900 text-sm">
                              {product.name}
                            </span>
                            <span className="text-[10px] font-mono px-1 py-0.5 bg-slate-100 rounded text-slate-600">
                              {product.sku}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1 text-xs">
                            <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full text-[11px] font-medium border border-teal-100">
                              {product.category}
                            </span>
                            <span className="flex items-center text-slate-500 text-[11px]">
                              <MapPin className="w-3 h-3 mr-0.5 text-emerald-600" />
                              {product.location}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onEditProduct(product)}
                          className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {confirmDeleteId === product.id ? (
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteProduct(product.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 bg-red-600 text-white font-bold text-xs rounded"
                            >
                              ยืนยันลบ
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-1 bg-slate-200 text-slate-700 text-xs rounded"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(product.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="ลบรายการสินค้านี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-500">เกณฑ์ขั้นต่ำ:</span>{' '}
                        <span className="font-bold text-slate-800">
                          {formatQty(product.minStock)} {product.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">เมื่อวาน:</span>{' '}
                        <span className="font-medium text-slate-700">
                          {yesterdayStock !== null ? `${formatQty(yesterdayStock)} ${product.unit}` : '-'}
                        </span>
                      </div>
                    </div>

                    {/* Big Mobile Counter Stepper */}
                    <div className="flex flex-col sm:flex-row items-center justify-between pt-1 gap-2">
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => onAdjustStock(product.id, -0.5, selectedDate)}
                          className="px-2 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold"
                          title="-0.5"
                        >
                          -0.5
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustStock(product.id, -1, selectedDate)}
                          className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-base border border-slate-200"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={inputValue}
                            onChange={(e) => handleInputChange(product.id, e.target.value)}
                            onBlur={() => handleInputBlur(product.id)}
                            className="w-24 text-center font-bold text-base py-1.5 border rounded-lg"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => onAdjustStock(product.id, +1, selectedDate)}
                          className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-base border border-slate-200"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustStock(product.id, +0.5, selectedDate)}
                          className="px-2 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold"
                          title="+0.5"
                        >
                          +0.5
                        </button>
                      </div>

                      <div className="text-right w-full sm:w-auto">
                        {isOutOfStock ? (
                          <div className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                            หมดสต็อก! (สั่ง +{formatQty(reorderQty)})
                          </div>
                        ) : isBelowMin ? (
                          <div className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                            ใกล้หมด (สั่ง +{formatQty(reorderQty)})
                          </div>
                        ) : (
                          <div className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                            ปกติ
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Undo Snackbar Toast */}
      {undoCount > 0 && lastUndoMessage && (
        <div className="fixed bottom-5 right-5 z-40 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 border border-slate-700 animate-slideUp">
          <div className="text-xs">
            <span className="text-slate-400">กรอกผิดหรือไม่?</span>{' '}
            <span className="font-semibold text-emerald-300">{lastUndoMessage}</span>
          </div>
          <button
            type="button"
            onClick={onUndo}
            className="flex items-center space-x-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ย้อนกลับ (Undo)</span>
          </button>
        </div>
      )}

      {/* Confirmation Modal for Resetting Day Stock to 0 */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">รีเซ็ตยอดวันนี้เป็น 0.00 ทั้งหมด?</h4>
                <p className="text-xs text-slate-500">วันที่: {selectedDate}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              คุณต้องการเปลี่ยนตัวเลขสต็อกของสินค้าทุกรายการในวันที่ <strong>{selectedDate}</strong> เป็น <strong>0.00</strong> หรือไม่? (ระบบจะบันทึกประวัติไว้ หากกดผิดสามารถกดย้อนกลับ Undo ได้)
            </p>

            <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onResetDayStockToZero) {
                    onResetDayStockToZero(selectedDate);
                  }
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ยืนยันรีเซ็ตเป็น 0.00</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
