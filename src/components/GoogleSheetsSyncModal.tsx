import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  X, 
  CheckCircle2, 
  ExternalLink, 
  AlertCircle, 
  Loader2, 
  LogOut,
  UploadCloud,
  Layers,
  HelpCircle
} from 'lucide-react';
import { googleSignIn, logout } from '../services/auth';
import { createAndPopulateSpreadsheet, ExportStockData } from '../services/googleSheets';
import { Product, DailyCountRecord, ReorderItem } from '../types/inventory';
import { User } from 'firebase/auth';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  setUser: (user: User | null) => void;
  products: Product[];
  dailyCounts: DailyCountRecord[];
  reorderItems: ReorderItem[];
  selectedDate: string;
  defaultExportType?: 'daily' | 'monthly' | 'yearly' | 'reorder';
  dateParam?: string;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  user,
  setUser,
  products,
  dailyCounts,
  reorderItems,
  selectedDate,
  defaultExportType = 'daily',
  dateParam,
}) => {
  const [exportType, setExportType] = useState<'daily' | 'reorder' | 'monthly' | 'yearly'>(
    defaultExportType
  );
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastExportedUrl, setLastExportedUrl] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
      }
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      setErrorMsg(err.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setLastExportedUrl(null);
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  // Prepare export payload
  const prepareExportPayload = (): ExportStockData => {
    const targetDate = dateParam || selectedDate;

    if (exportType === 'daily') {
      const headers = [
        'รหัส SKU',
        'ชื่อสินค้า',
        'หมวดหมู่',
        'ที่อยู่จัดเก็บ (Location)',
        'ผู้จำหน่าย (Supplier)',
        'เกณฑ์ขั้นต่ำ',
        `ยอดคงเหลือ (${targetDate})`,
        'หน่วยนับ',
        'สถานะสต็อก',
        'จำนวนที่ต้องสั่งเพิ่ม',
        'ต้นทุนต่อหน่วย (บาท)',
      ];

      const rows = products.map((p) => {
        const record = dailyCounts.find((c) => c.productId === p.id && c.date === targetDate);
        const qty = record ? Math.round(record.quantity * 100) / 100 : '';
        const reorderQty =
          typeof qty === 'number' && qty <= p.minStock
            ? Math.round(Math.max(0, p.minStock - qty) * 100) / 100
            : 0;
        let status = 'ยังไม่ได้นับ';
        if (typeof qty === 'number') {
          if (qty === 0) status = 'หมดสต็อก (0)';
          else if (qty <= p.minStock) status = 'ต่ำกว่าเกณฑ์';
          else status = 'ปกติ';
        }

        return [
          p.sku,
          p.name,
          p.category,
          p.location,
          p.supplier,
          Math.round(p.minStock * 100) / 100,
          qty,
          p.unit,
          status,
          reorderQty,
          p.unitCost || 0,
        ];
      });

      return {
        title: `รายงานสต็อกสินค้าประจำวัน_${targetDate}`,
        sheetName: `สต็อก_${targetDate}`,
        headers,
        rows,
      };
    } else if (exportType === 'reorder') {
      const headers = [
        'ลำดับ',
        'ผู้จำหน่าย (Supplier)',
        'รหัส SKU',
        'ชื่อสินค้า',
        'ที่อยู่จัดเก็บ',
        'ยอดคงเหลือปัจจุบัน',
        'เกณฑ์ขั้นต่ำ',
        'ต้องสั่งเพิ่ม',
        'หน่วยนับ',
        'ราคาต่อหน่วย (บาท)',
        'ประมาณการงบประมาณ (บาท)',
        'สถานะความเร่งด่วน',
      ];

      const rows = reorderItems.map((item, idx) => [
        idx + 1,
        item.product.supplier,
        item.product.sku,
        item.product.name,
        item.product.location,
        Math.round(item.currentStock * 100) / 100,
        Math.round(item.minStock * 100) / 100,
        Math.round(item.reorderQuantity * 100) / 100,
        item.product.unit,
        item.product.unitCost,
        item.estimatedCost,
        item.status === 'OUT_OF_STOCK'
          ? 'ด่วนที่สุด (หมดสต็อก)'
          : item.status === 'CRITICAL'
          ? 'ด่วน (เหลือน้อยมาก)'
          : 'เตือน (ต่ำกว่าเกณฑ์)',
      ]);

      return {
        title: `ใบสรุปสั่งซื้อสินค้าเพิ่ม_Reorder_${targetDate}`,
        sheetName: 'รายการสั่งซื้อ',
        headers,
        rows,
      };
    } else if (exportType === 'monthly') {
      const monthStr = dateParam || selectedDate.substring(0, 7);
      const headers = [
        'รหัส SKU',
        'ชื่อสินค้า',
        'หมวดหมู่',
        'หน่วยนับ',
        'เกณฑ์ขั้นต่ำ',
        'ยอดคงเหลือล่าสุดในเดือน',
        'ยอดเฉลี่ยรายวัน',
        'จำนวนวันที่ต่ำกว่าเกณฑ์',
      ];

      const monthCounts = dailyCounts.filter((c) => c.date.startsWith(monthStr));
      const rows = products.map((p) => {
        const records = monthCounts.filter((c) => c.productId === p.id);
        const quantities = records.map((r) => r.quantity);
        const count = quantities.length;
        const avg = count > 0 ? Math.round((quantities.reduce((a, b) => a + b, 0) / count) * 10) / 10 : '-';
        const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
        const endOfMonthQty = sorted.length > 0 ? sorted[0].quantity : '-';
        const belowCount = quantities.filter((q) => q <= p.minStock).length;

        return [
          p.sku,
          p.name,
          p.category,
          p.unit,
          p.minStock,
          endOfMonthQty,
          avg,
          belowCount,
        ];
      });

      return {
        title: `รายงานสต็อกสินค้าประจำเดือน_${monthStr}`,
        sheetName: `สรุปเดือน_${monthStr}`,
        headers,
        rows,
      };
    } else {
      // Yearly
      const yearStr = dateParam || selectedDate.substring(0, 4);
      const headers = [
        'รหัส SKU',
        'ชื่อสินค้า',
        'หมวดหมู่',
        'หน่วยนับ',
        'เกณฑ์ขั้นต่ำ',
        'ยอดเฉลี่ยทั้งปี',
        'จำนวนวันที่บันทึกในปีนี้',
      ];

      const yearCounts = dailyCounts.filter((c) => c.date.startsWith(yearStr));
      const rows = products.map((p) => {
        const records = yearCounts.filter((c) => c.productId === p.id);
        const count = records.length;
        const avg = count > 0 ? Math.round((records.reduce((a, b) => a + b.quantity, 0) / count) * 10) / 10 : '-';

        return [
          p.sku,
          p.name,
          p.category,
          p.unit,
          p.minStock,
          avg,
          count,
        ];
      });

      return {
        title: `รายงานสต็อกสินค้าประจำปี_${yearStr}`,
        sheetName: `สรุปปี_${yearStr}`,
        headers,
        rows,
      };
    }
  };

  // Perform actual export after confirmation
  const executeExport = async () => {
    setShowConfirmDialog(false);
    setIsExporting(true);
    setErrorMsg(null);
    setLastExportedUrl(null);

    try {
      const payload = prepareExportPayload();
      const res = await createAndPopulateSpreadsheet(payload);
      setLastExportedUrl(res.spreadsheetUrl);
    } catch (err: any) {
      console.error('Google Sheets export error:', err);
      setErrorMsg(err.message || 'ส่งออกข้อมูลไป Google Sheets ไม่สำเร็จ');
    } finally {
      setIsExporting(false);
    }
  };

  const payloadPreview = prepareExportPayload();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                เชื่อมต่อ &amp; ส่งออก Google Sheets
              </h3>
              <p className="text-xs text-slate-500">
                Google Workspace Integration ด้วยความยินยอมของผู้ใช้งาน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* User Sign-In Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Google User'}
                      className="w-10 h-10 rounded-full border border-emerald-300"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                      {user.displayName?.[0] || 'U'}
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      {user.displayName || 'Google Account'}
                    </div>
                    <div className="text-[11px] text-slate-500">{user.email}</div>
                    <div className="flex items-center text-[10px] text-emerald-700 font-medium mt-0.5">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> เชื่อมต่อกับ Google Workspace สำเร็จ
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-200 text-xs flex items-center space-x-1"
                  title="ออกจากระบบ Google"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">ออกระบบ</span>
                </button>
              </div>
            ) : (
              <div className="text-center py-2 space-y-3">
                <p className="text-xs text-slate-600">
                  กรุณาเข้าสู่ระบบ Google เพื่ออนุญาตให้แอปส่งออกข้อมูลสต็อกไปยัง Google Drive และ Google Sheets ของคุณ
                </p>

                {/* Official Material Google Sign-In Button */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isSigningIn}
                    className="flex items-center space-x-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-lg border border-slate-300 shadow-xs transition-all active:scale-95 disabled:opacity-60"
                  >
                    {isSigningIn ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 48 48">
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                      </svg>
                    )}
                    <span>{isSigningIn ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google (Sign in with Google)'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800">
              เลือกรูปแบบข้อมูลที่ต้องการส่งออก:
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setExportType('daily');
                  setLastExportedUrl(null);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  exportType === 'daily'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-bold ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-semibold">สต็อกคงเหลือประจำวัน</div>
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                  วันที่: {dateParam || selectedDate}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExportType('reorder');
                  setLastExportedUrl(null);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  exportType === 'reorder'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-bold ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-semibold">ใบสรุปสั่งซื้อเพิ่ม (Reorder)</div>
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                  {reorderItems.length} รายการที่ต้องสั่ง
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExportType('monthly');
                  setLastExportedUrl(null);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  exportType === 'monthly'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-bold ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-semibold">รายงานประจำเดือน</div>
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                  สถิติเฉลี่ย &amp; สินค้าต่ำสุด
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExportType('yearly');
                  setLastExportedUrl(null);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  exportType === 'yearly'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-bold ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-semibold">รายงานประจำปี</div>
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                  ยอดเฉลี่ยทั้งปี
                </div>
              </button>
            </div>
          </div>

          {/* Export Payload Preview */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">ชื่อไฟล์สเปรดชีต:</span>
              <span className="font-bold text-slate-800">{payloadPreview.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">จำนวนแถวข้อมูล:</span>
              <span className="font-medium text-slate-700">{payloadPreview.rows.length} แถว</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">จำนวนคอลัมน์:</span>
              <span className="font-medium text-slate-700">{payloadPreview.headers.length} คอลัมน์</span>
            </div>
          </div>

          {/* Success Message & Direct Open Link */}
          {lastExportedUrl && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>สร้างและบันทึก Google Sheets เรียบร้อยแล้ว!</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                ไฟล์ถูกบันทึกไว้ใน Google Drive ของคุณแล้ว สามารถคลิกเปิดดูเพื่อแชร์หรือพิมพ์ได้ทันที
              </p>
              <a
                href={lastExportedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <span>เปิดดูใน Google Sheets</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">เกิดข้อผิดพลาดในการเชื่อมต่อ</div>
                <div className="text-[11px] mt-0.5">{errorMsg}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer & Action Button */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            ปิดหน้าต่าง
          </button>

          <button
            type="button"
            onClick={() => setShowConfirmDialog(true)}
            disabled={!user || isExporting}
            className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังส่งออกข้อมูล...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>ส่งออกไปยัง Google Sheets</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mandatory User Confirmation Dialog for Workspace Operations */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2.5 text-slate-900">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <h4 className="font-bold text-sm">ยืนยันการสร้างสเปรดชีต Google Sheets?</h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ระบบจะทำการสร้างไฟล์ Google Spreadsheet ใหม่ชื่อ <strong>"{payloadPreview.title}"</strong> ในบัญชี Google Drive ของคุณ ({user?.email}) พร้อมบันทึกข้อมูลสินค้าจำนวน <strong>{payloadPreview.rows.length} รายการ</strong>
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeExport}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors"
              >
                ยืนยันการส่งออก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
