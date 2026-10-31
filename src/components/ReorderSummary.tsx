import React, { useState, useMemo } from 'react';
import { ReorderItem, Product } from '../types/inventory';
import { 
  ShoppingCart, 
  Truck, 
  Printer, 
  FileSpreadsheet, 
  Copy, 
  Check, 
  AlertTriangle, 
  AlertOctagon, 
  Package, 
  ArrowRight,
  TrendingDown,
  Building,
  MessageCircle
} from 'lucide-react';
import { formatQty } from '../utils/numberFormat';

interface ReorderSummaryProps {
  reorderItems: ReorderItem[];
  selectedDate: string;
  onOpenSheetsSync: () => void;
  onSelectProductToCount: (productId: string) => void;
  onOpenLineSync?: () => void;
}

export const ReorderSummary: React.FC<ReorderSummaryProps> = ({
  reorderItems,
  selectedDate,
  onOpenSheetsSync,
  onSelectProductToCount,
  onOpenLineSync,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('ALL');

  // Distinct suppliers needing reorder
  const suppliers = useMemo(() => {
    const set = new Set<string>();
    reorderItems.forEach((item) => set.add(item.product.supplier));
    return Array.from(set).sort();
  }, [reorderItems]);

  // Filtered items by supplier
  const filteredItems = useMemo(() => {
    if (selectedSupplierFilter === 'ALL') return reorderItems;
    return reorderItems.filter((i) => i.product.supplier === selectedSupplierFilter);
  }, [reorderItems, selectedSupplierFilter]);

  // Group by supplier
  const groupedBySupplier = useMemo(() => {
    const map = new Map<string, ReorderItem[]>();
    for (const item of filteredItems) {
      const s = item.product.supplier || 'ไม่ระบุผู้จำหน่าย';
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(item);
    }
    return Array.from(map.entries());
  }, [filteredItems]);

  // Totals
  const totalItemsCount = filteredItems.length;
  const totalUnitsToOrder = filteredItems.reduce((acc, i) => acc + i.reorderQuantity, 0);
  const totalEstimatedCost = filteredItems.reduce((acc, i) => acc + i.estimatedCost, 0);
  const outOfStockCount = filteredItems.filter((i) => i.status === 'OUT_OF_STOCK').length;

  const handleCopyText = () => {
    let text = `📦 ใบสรุปรายการสั่งซื้อสินค้าเพิ่ม (ณ วันที่ ${selectedDate})\n`;
    text += `=====================================\n`;
    groupedBySupplier.forEach(([supplier, items]) => {
      text += `\n🏢 ผู้จำหน่าย: ${supplier}\n`;
      items.forEach((item, idx) => {
        text += `  ${idx + 1}. ${item.product.name} (SKU: ${item.product.sku})\n`;
        text += `     คงเหลือ: ${formatQty(item.currentStock)} ${item.product.unit} (เกณฑ์ต่ำสุด: ${formatQty(item.minStock)} ${item.product.unit})\n`;
        text += `     👉 สั่งเพิ่ม: ${formatQty(item.reorderQuantity)} ${item.product.unit} (ประมาณ ฿${item.estimatedCost.toLocaleString()})\n`;
      });
    });
    text += `\n=====================================\n`;
    text += `รวมสินค้าต้องสั่ง: ${totalItemsCount} รายการ | รวมจำนวน: ${formatQty(totalUnitsToOrder)} หน่วย\n`;
    text += `งบประมาณโดยประมาณ: ฿${totalEstimatedCost.toLocaleString()}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Summary Cards */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                ใบสรุปการสั่งซื้อสินค้าเพิ่ม (Reorder Plan)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              คำนวณจากเกณฑ์สต็อกขั้นต่ำที่ตั้งไว้ เพื่อป้องกันสินค้าขาดสต็อก ณ วันที่ {selectedDate}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenLineSync && (
              <button
                type="button"
                onClick={onOpenLineSync}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#06C755]/10 hover:bg-[#06C755]/20 text-[#05a847] text-xs font-semibold rounded-lg border border-[#06C755]/30 transition-colors shadow-2xs cursor-pointer"
                title="ส่งใบสรุปสั่งของเข้ากลุ่ม LINE"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#06C755]" />
                <span>แชร์เข้า LINE</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyText}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกข้อความ PO'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์ใบสั่งซื้อ</span>
            </button>

            <button
              type="button"
              onClick={onOpenSheetsSync}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>ส่งออกไป Google Sheets</span>
            </button>
          </div>
        </div>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
            <div className="text-[11px] text-slate-500 font-medium">รายการที่ต้องสั่ง</div>
            <div className="text-lg font-bold text-slate-900">{totalItemsCount} รายการ</div>
            <div className="text-[10px] text-slate-400">จากทั้งหมด {reorderItems.length} รายการ</div>
          </div>

          <div className="bg-red-50 p-3 rounded-lg border border-red-100">
            <div className="text-[11px] text-red-700 font-medium">หมดสต็อกวิกฤต (0)</div>
            <div className="text-lg font-bold text-red-900">{outOfStockCount} รายการ</div>
            <div className="text-[10px] text-red-600">ต้องรีบสั่งด่วน</div>
          </div>

          <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
            <div className="text-[11px] text-amber-700 font-medium">จำนวนชิ้นที่ต้องสั่งรวม</div>
            <div className="text-lg font-bold text-amber-900">
              +{formatQty(totalUnitsToOrder)} หน่วย
            </div>
            <div className="text-[10px] text-amber-600">ตามเกณฑ์ขั้นต่ำ</div>
          </div>

          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
            <div className="text-[11px] text-emerald-700 font-medium">งบประมาณโดยประมาณ</div>
            <div className="text-lg font-bold text-emerald-900">
              ฿{totalEstimatedCost.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-600">ตามต้นทุนต่อหน่วย</div>
          </div>
        </div>

        {/* Filter by Supplier */}
        {suppliers.length > 0 && (
          <div className="flex items-center space-x-2 pt-4 mt-2 border-t border-slate-100 text-xs">
            <Truck className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600 font-medium">เลือกดูตามผู้จำหน่าย:</span>
            <select
              value={selectedSupplierFilter}
              onChange={(e) => setSelectedSupplierFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-800 font-semibold focus:outline-hidden"
            >
              <option value="ALL">ผู้จำหน่ายทั้งหมด ({suppliers.length} ราย)</option>
              {suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Supplier Groups & Items List */}
      {reorderItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 shadow-xs">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">ไม่มีสินค้าที่ต้องสั่งเพิ่มในขณะนี้</h3>
          <p className="text-xs text-slate-500 mt-1">
            สินค้าทุกรายการมียอดคงเหลือเกินเกณฑ์ขั้นต่ำที่ตั้งไว้เรียบร้อยแล้ว
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedBySupplier.map(([supplier, items]) => {
            const subtotalCost = items.reduce((acc, i) => acc + i.estimatedCost, 0);
            const subtotalUnits = items.reduce((acc, i) => acc + i.reorderQuantity, 0);

            return (
              <div
                key={supplier}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
              >
                {/* Supplier Group Header */}
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-slate-800 text-sm">{supplier}</span>
                    <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      {items.length} รายการ
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 font-medium">
                    รวม {formatQty(subtotalUnits)} หน่วย • ประมาณ ฿{subtotalCost.toLocaleString()}
                  </div>
                </div>

                {/* Items in Supplier */}
                <div className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const isOutOfStock = item.status === 'OUT_OF_STOCK';
                    const isCritical = item.status === 'CRITICAL';

                    return (
                      <div
                        key={item.product.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            {isOutOfStock ? (
                              <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />
                            ) : (
                              <AlertTriangle
                                className={`w-4 h-4 shrink-0 ${
                                  isCritical ? 'text-orange-600' : 'text-amber-600'
                                }`}
                              />
                            )}
                            <span className="font-semibold text-slate-900 text-sm">
                              {item.product.name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {item.product.sku}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                            <span>ตำแหน่ง: {item.product.location}</span>
                            <span>•</span>
                            <span>หมวด: {item.product.category}</span>
                            {item.product.unitCost > 0 && (
                              <>
                                <span>•</span>
                                <span>ต้นทุน: ฿{item.product.unitCost} / {item.product.unit}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Stock numbers & reorder calculation */}
                        <div className="flex items-center justify-between sm:justify-end space-x-4">
                          <div className="text-right text-xs">
                            <div className="text-slate-500">
                              คงเหลือ:{' '}
                              <span
                                className={`font-bold ${
                                  isOutOfStock ? 'text-red-600' : 'text-amber-700'
                                }`}
                              >
                                {formatQty(item.currentStock)} {item.product.unit}
                              </span>
                            </div>
                            <div className="text-slate-400 text-[11px]">
                              ขั้นต่ำ: {formatQty(item.minStock)} {item.product.unit}
                            </div>
                          </div>

                          <div className="text-right bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                            <div className="text-xs font-bold text-emerald-800">
                              สั่งเพิ่ม +{formatQty(item.reorderQuantity)} {item.product.unit}
                            </div>
                            {item.estimatedCost > 0 && (
                              <div className="text-[10px] text-emerald-600">
                                ~฿{item.estimatedCost.toLocaleString()}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => onSelectProductToCount(item.product.id)}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors text-xs"
                            title="ปรับยอดสต็อกสินค้านี้"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
