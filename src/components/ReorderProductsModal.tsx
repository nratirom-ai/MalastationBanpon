import React, { useState } from 'react';
import { Product } from '../types/inventory';
import { 
  X, 
  ArrowUp, 
  ArrowDown, 
  ArrowUpToLine, 
  ArrowDownToLine, 
  Search, 
  SlidersHorizontal, 
  MapPin, 
  Tag, 
  Check, 
  RotateCcw,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';

interface ReorderProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSaveOrder: (newProducts: Product[], reason?: string) => void;
  onSortPreset: (criteria: 'name' | 'category' | 'location' | 'supplier' | 'sku') => void;
}

export const ReorderProductsModal: React.FC<ReorderProductsModalProps> = ({
  isOpen,
  onClose,
  products,
  onSaveOrder,
  onSortPreset,
}) => {
  const [orderedList, setOrderedList] = useState<Product[]>(products);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [jumpInputs, setJumpInputs] = useState<Record<string, string>>({});

  // Sync with prop when opened
  React.useEffect(() => {
    if (isOpen) {
      setOrderedList(products);
      setHasChanges(false);
      setSearchQuery('');
    }
  }, [isOpen, products]);

  if (!isOpen) return null;

  // Move single item by delta
  const handleMove = (productId: string, delta: number) => {
    const currentIndex = orderedList.findIndex((p) => p.id === productId);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + delta;
    if (targetIndex < 0 || targetIndex >= orderedList.length) return;

    const next = [...orderedList];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, moved);

    setOrderedList(next);
    setHasChanges(true);
  };

  // Move to top
  const handleMoveToTop = (productId: string) => {
    const currentIndex = orderedList.findIndex((p) => p.id === productId);
    if (currentIndex <= 0) return;

    const next = [...orderedList];
    const [moved] = next.splice(currentIndex, 1);
    next.unshift(moved);

    setOrderedList(next);
    setHasChanges(true);
  };

  // Move to bottom
  const handleMoveToBottom = (productId: string) => {
    const currentIndex = orderedList.findIndex((p) => p.id === productId);
    if (currentIndex === -1 || currentIndex === orderedList.length - 1) return;

    const next = [...orderedList];
    const [moved] = next.splice(currentIndex, 1);
    next.push(moved);

    setOrderedList(next);
    setHasChanges(true);
  };

  // Move directly to specific 1-based rank
  const handleJumpToRank = (productId: string, rank1Based: number) => {
    const currentIndex = orderedList.findIndex((p) => p.id === productId);
    if (currentIndex === -1) return;

    const targetIndex = Math.max(0, Math.min(orderedList.length - 1, rank1Based - 1));
    if (currentIndex === targetIndex) return;

    const next = [...orderedList];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, moved);

    setOrderedList(next);
    setHasChanges(true);
    setJumpInputs((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  // Presets
  const applyPreset = (criteria: 'location' | 'category' | 'name' | 'sku') => {
    const sorted = [...orderedList].sort((a, b) => {
      const valA = (a[criteria] || '').toString();
      const valB = (b[criteria] || '').toString();
      return valA.localeCompare(valB, 'th');
    });
    setOrderedList(sorted);
    setHasChanges(true);
  };

  // Filtered display
  const displayedItems = orderedList.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const handleSave = () => {
    onSaveOrder(orderedList, 'บันทึกลำดับวัตถุดิบใหม่');
    onClose();
  };

  const handleReset = () => {
    setOrderedList(products);
    setHasChanges(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ArrowUpDown className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-bold text-slate-900">
                จัดเรียงลำดับวัตถุดิบและสินค้า ({orderedList.length} รายการ)
              </h2>
              <p className="text-xs text-slate-500">
                ปรับลำดับตามการเดินตรวจนับในร้าน (เช่น หน้าเคาน์เตอร์, ตู้เย็น, ชั้นวาง)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Presets */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 space-y-3">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาวัตถุดิบเพื่อปรับลำดับ..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
                title="คืนค่าลำดับเริ่มต้น"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>รีเซ็ต</span>
              </button>
            )}
          </div>

          {/* Quick presets */}
          <div className="flex items-center flex-wrap gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center mr-1">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" /> จัดเรียงอัตโนมัติ:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('location')}
              className="px-2.5 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-md text-[11px] font-medium text-slate-700 transition-colors shadow-2xs"
            >
              📍 ตามที่อยู่จัดเก็บ (Location)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('category')}
              className="px-2.5 py-1 bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 border border-slate-200 rounded-md text-[11px] font-medium text-slate-700 transition-colors shadow-2xs"
            >
              🏷️ ตามหมวดหมู่
            </button>
            <button
              type="button"
              onClick={() => applyPreset('name')}
              className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 rounded-md text-[11px] font-medium text-slate-700 transition-colors shadow-2xs"
            >
              🔤 ตามชื่อ (ก-ฮ)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('sku')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-[11px] font-medium text-slate-700 transition-colors shadow-2xs"
            >
              # รหัส SKU
            </button>
          </div>
        </div>

        {/* Scrollable Products List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 sm:p-3">
          {displayedItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              ไม่พบรายการสินค้าที่ตรงกับคำค้นหา
            </div>
          ) : (
            displayedItems.map((product) => {
              const fullIndex = orderedList.findIndex((p) => p.id === product.id);
              const isFirst = fullIndex === 0;
              const isLast = fullIndex === orderedList.length - 1;
              const currentJumpVal = jumpInputs[product.id] ?? String(fullIndex + 1);

              return (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-2.5 sm:px-3 sm:py-2.5 hover:bg-slate-50/80 rounded-xl transition-colors group"
                >
                  {/* Left: Position Rank & Info */}
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    {/* Rank Badge & Quick input */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center justify-center border border-emerald-200">
                        #{fullIndex + 1}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                          {product.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {product.sku}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="text-teal-700 font-medium bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                          {product.category}
                        </span>
                        <span className="flex items-center text-slate-500 truncate">
                          <MapPin className="w-3 h-3 mr-0.5 text-emerald-600 shrink-0" />
                          {product.location}
                        </span>
                        <span className="text-slate-400 hidden sm:inline">
                          ({product.unit})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Reorder Action Controls */}
                  <div className="flex items-center space-x-1 shrink-0">
                    {/* Direct Rank Jump Input */}
                    <div className="hidden sm:flex items-center space-x-1 mr-2 text-xs">
                      <span className="text-[10px] text-slate-400">ลำดับที่:</span>
                      <input
                        type="number"
                        min="1"
                        max={orderedList.length}
                        value={currentJumpVal}
                        onChange={(e) =>
                          setJumpInputs((prev) => ({
                            ...prev,
                            [product.id]: e.target.value,
                          }))
                        }
                        onBlur={() => {
                          const val = parseInt(currentJumpVal, 10);
                          if (!isNaN(val)) {
                            handleJumpToRank(product.id, val);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt(currentJumpVal, 10);
                            if (!isNaN(val)) {
                              handleJumpToRank(product.id, val);
                            }
                          }
                        }}
                        className="w-12 text-center text-xs font-bold py-1 bg-white border border-slate-300 rounded focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        title="พิมพ์เลขลำดับแล้วกด Enter หรือคลิกข้างนอกเพื่อย้ายไปตำแหน่งนั้นทันที"
                      />
                    </div>

                    {/* Move to Top */}
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveToTop(product.id)}
                      className={`p-1.5 rounded-lg text-xs transition-colors ${
                        isFirst
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200'
                      }`}
                      title="ย้ายไปบนสุด"
                    >
                      <ArrowUpToLine className="w-4 h-4" />
                    </button>

                    {/* Move Up */}
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMove(product.id, -1)}
                      className={`p-1.5 rounded-lg text-xs transition-colors ${
                        isFirst
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200'
                      }`}
                      title="ย้ายขึ้น 1 ลำดับ"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMove(product.id, 1)}
                      className={`p-1.5 rounded-lg text-xs transition-colors ${
                        isLast
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200'
                      }`}
                      title="ย้ายลง 1 ลำดับ"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>

                    {/* Move to Bottom */}
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveToBottom(product.id)}
                      className={`p-1.5 rounded-lg text-xs transition-colors ${
                        isLast
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200'
                      }`}
                      title="ย้ายไปล่างสุด"
                    >
                      <ArrowDownToLine className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {hasChanges ? (
              <span className="text-emerald-700 font-semibold flex items-center">
                <Check className="w-3.5 h-3.5 mr-1" /> มีการแก้ไขลำดับ (กดบันทึกเพื่อใช้งาน)
              </span>
            ) : (
              <span>ลำดับตรงกับข้อมูลปัจจุบัน</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>บันทึกลำดับ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
