import { StockAlert } from '../types/inventory';
import { AlertTriangle, AlertOctagon, CheckCircle2, X, ShoppingCart } from 'lucide-react';
import { formatQty } from '../utils/numberFormat';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: StockAlert[];
  onSelectProduct: (productId: string) => void;
  onOpenReorder: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  alerts,
  onSelectProduct,
  onOpenReorder,
}) => {
  if (!isOpen) return null;

  const outOfStockCount = alerts.filter((a) => a.severity === 'out_of_stock').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div 
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-out border-l border-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-base">
                แจ้งเตือนสต็อกสินค้าคงเหลือ
              </h3>
              <p className="text-xs text-slate-500">
                ตรวจพบสินค้าถึงเกณฑ์ขั้นต่ำ {alerts.length} รายการ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status badges summary */}
        <div className="p-3 bg-amber-50/70 border-b border-amber-100 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-red-100 text-red-800 py-1.5 px-2 rounded-md font-medium">
            หมดสต็อก: <span className="font-bold">{outOfStockCount}</span>
          </div>
          <div className="bg-orange-100 text-orange-800 py-1.5 px-2 rounded-md font-medium">
            วิกฤต: <span className="font-bold">{criticalCount}</span>
          </div>
          <div className="bg-yellow-100 text-yellow-800 py-1.5 px-2 rounded-md font-medium">
            ใกล้หมด: <span className="font-bold">{warningCount}</span>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2 opacity-80" />
              <p className="text-slate-600 font-medium">สต็อกสินค้าอยู่ในเกณฑ์ปกติทั้งหมด</p>
              <p className="text-xs text-slate-400 mt-1">ไม่มีสินค้ารายการใดต่ำกว่าเกณฑ์ขั้นต่ำ</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const isOutOfStock = alert.severity === 'out_of_stock';
              const isCritical = alert.severity === 'critical';

              return (
                <div
                  key={alert.id}
                  onClick={() => {
                    onSelectProduct(alert.productId);
                    onClose();
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                    isOutOfStock
                      ? 'border-red-200 bg-red-50/50 hover:bg-red-50'
                      : isCritical
                      ? 'border-orange-200 bg-orange-50/50 hover:bg-orange-50'
                      : 'border-yellow-200 bg-yellow-50/40 hover:bg-yellow-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2.5">
                      <div className="mt-0.5">
                        {isOutOfStock ? (
                          <AlertOctagon className="w-5 h-5 text-red-600" />
                        ) : (
                          <AlertTriangle
                            className={`w-5 h-5 ${isCritical ? 'text-orange-600' : 'text-amber-600'}`}
                          />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900 text-sm">
                          {alert.productName}
                        </h4>
                        <div className="flex items-center space-x-2 mt-1 text-xs">
                          <span
                            className={`font-semibold px-2 py-0.5 rounded-full ${
                              isOutOfStock
                                ? 'bg-red-200 text-red-900'
                                : isCritical
                                ? 'bg-orange-200 text-orange-900'
                                : 'bg-yellow-200 text-yellow-900'
                            }`}
                          >
                            คงเหลือ: {formatQty(alert.currentStock)} {alert.unit}
                          </span>
                          <span className="text-slate-500">
                            (เกณฑ์ขั้นต่ำ: {formatQty(alert.minStock)} {alert.unit})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                    <span className="text-rose-700 font-medium">
                      ต้องสั่งเพิ่ม: +{formatQty(Math.max(0, alert.minStock - alert.currentStock))} {alert.unit}
                    </span>
                    <span className="text-indigo-600 hover:text-indigo-800 font-medium">
                      คลิกเพื่อปรับสต็อก →
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {alerts.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button
              onClick={() => {
                onOpenReorder();
                onClose();
              }}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition-colors text-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>เปิดดูใบสรุปสั่งของเพิ่ม ({alerts.length} รายการ)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
