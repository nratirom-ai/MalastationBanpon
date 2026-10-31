import React, { useState } from 'react';
import { 
  Send, 
  Share2, 
  Check, 
  Copy, 
  Bell, 
  Radio, 
  ExternalLink, 
  HelpCircle, 
  Database, 
  CheckCircle2, 
  AlertCircle,
  Smartphone,
  Globe,
  MessageCircle,
  X,
  RefreshCw
} from 'lucide-react';
import { LineSyncSettings, SyncStatus, ReorderItem, Product } from '../types/inventory';
import { buildLineStockReport, openLineShare, sendLineNotify } from '../services/lineService';

interface LineSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  lineSettings: LineSyncSettings;
  onUpdateLineSettings: (settings: Partial<LineSyncSettings>) => Promise<void>;
  selectedDate: string;
  products: Product[];
  reorderItems: ReorderItem[];
  getProductStockOnDate: (productId: string, date: string) => number;
}

export function LineSyncModal({
  isOpen,
  onClose,
  syncStatus,
  lineSettings,
  onUpdateLineSettings,
  selectedDate,
  products,
  reorderItems,
  getProductStockOnDate,
}: LineSyncModalProps) {
  const [tokenInput, setTokenInput] = useState(lineSettings.lineNotifyToken || '');
  const [webhookInput, setWebhookInput] = useState(lineSettings.webhookUrl || '');
  const [autoNotify, setAutoNotify] = useState(lineSettings.autoNotifyLowStock ?? true);
  const [isCopied, setIsCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  // Calculate current stock overview for preview
  const totalProducts = products.length;
  let countedCount = 0;
  let normalCount = 0;
  let outOfStockCount = 0;
  let criticalCount = 0;

  for (const p of products) {
    const stock = getProductStockOnDate(p.id, selectedDate);
    if (stock > 0) countedCount++;
    if (stock === 0) outOfStockCount++;
    else if (stock <= p.minStock * 0.5) criticalCount++;
    else if (stock > p.minStock) normalCount++;
  }

  const previewReport = buildLineStockReport({
    date: selectedDate,
    totalProducts,
    countedCount,
    reorderItems,
    normalCount,
    outOfStockCount,
    criticalCount,
  });

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(previewReport);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard write error', e);
    }
  };

  const handleShareToLineApp = () => {
    openLineShare(previewReport);
    setSendResult({
      success: true,
      message: 'เปิด LINE เพื่อแชร์ข้อมูลสต็อกเรียบร้อยแล้ว',
    });
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await onUpdateLineSettings({
        lineNotifyToken: tokenInput.trim(),
        webhookUrl: webhookInput.trim(),
        autoNotifyLowStock: autoNotify,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestToLine = async () => {
    setIsSending(true);
    setSendResult(null);
    try {
      const target = tokenInput.trim() || webhookInput.trim();
      const res = await sendLineNotify(target, previewReport);
      setSendResult(res);
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err?.message || 'ส่งไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shadow-inner">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                ซิงค์ข้อมูล Web Browser, Web App และ LINE
              </h2>
              <p className="text-xs text-emerald-100">
                ข้อมูลทุกอุปกรณ์และในกลุ่ม LINE อัปเดตตรงกันแบบเรียลไทม์
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Real-time Status Card across Web Browser & Mobile Web App */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Radio className={`w-4 h-4 ${syncStatus.isFirestoreConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
                <span>สถานะการซิงค์ข้อมูลเรียลไทม์ (Cloud Sync)</span>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1.5 ${
                syncStatus.isFirestoreConnected 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {syncStatus.isFirestoreConnected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    เชื่อมต่อคลาวด์เรียบร้อย
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    กำลังเชื่อมต่อ / โหมดออฟไลน์
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-sky-600 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-700">Web Browser</div>
                  <div className="text-slate-500">แท็บ/คอมพิวเตอร์</div>
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-700">Mobile Web App</div>
                  <div className="text-slate-500">มือถือ / ไอแพด PWA</div>
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 flex items-center gap-2.5">
                <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-700">LINE App & Chat</div>
                  <div className="text-slate-500">อัปเดตแจ้งเตือนกลุ่ม</div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 bg-white/80 p-2.5 rounded-lg border border-slate-200/60 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                ฐานข้อมูล Firestore: <code className="text-slate-700 font-mono">ai-studio-dailystockinvent</code>
              </span>
              <span>
                อัปเดตล่าสุด: {syncStatus.lastSyncedAt ? syncStatus.lastSyncedAt.toLocaleTimeString('th-TH') : 'เรียลไทม์'}
              </span>
            </div>
          </div>

          {/* Action 1: Instant 1-Click LINE Share */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/70 border border-emerald-200 rounded-xl p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-emerald-600" />
                  ส่งสรุปยอดสต็อกเข้า LINE ทันที (ไม่ต้องตั้งค่า Token)
                </h3>
                <p className="text-xs text-emerald-800/80 mt-0.5">
                  คลิกเดียวจะเปิดแอป LINE บนมือถือหรือ LINE PC พร้อมส่งสรุปสต็อกสินค้าที่ต้องสั่งซื้อเข้ากลุ่มได้ทันที
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                onClick={handleShareToLineApp}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                แชร์สรุปสต็อกเข้าแอป LINE ทันที
              </button>

              <button
                onClick={handleCopyReport}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-xl border border-slate-300 shadow-xs active:scale-98 transition-all cursor-pointer"
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">คัดลอกแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>คัดลอกข้อความ</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action 2: LINE Token & Automation Setup */}
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600" />
                การแจ้งเตือนอัตโนมัติผ่าน LINE Notify / Webhook
              </h3>
              <a
                href="https://notify-bot.line.me/my/"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-700 hover:text-emerald-800 font-medium inline-flex items-center gap-1"
              >
                รับ Token LINE Notify <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  LINE Notify Access Token (หรือ Webhook URL)
                </label>
                <input
                  type="text"
                  placeholder="วาง Access Token จาก LINE Notify เช่น eyJhbGciOi..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  นำ Token มาใส่เพื่อส่งแจ้งเตือนเข้ากลุ่ม LINE ได้อัตโนมัติ
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-800">
                    แจ้งเตือนอัตโนมัติเมื่อสินค้าถึงจุดสั่งซื้อขั้นต่ำ
                  </div>
                  <div className="text-[11px] text-slate-500">
                    ระบบจะส่งแจ้งเตือนเมื่อนับสต็อกแล้วพบว่าวัตถุดิบหมดหรือเหลือน้อยกว่าขั้นต่ำ
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoNotify}
                    onChange={(e) => setAutoNotify(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  {saveSuccess ? 'บันทึกการตั้งค่าเรียบร้อย ✓' : 'บันทึกการตั้งค่า'}
                </button>

                {tokenInput.trim() && (
                  <button
                    type="button"
                    onClick={handleSendTestToLine}
                    disabled={isSending}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    {isSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    ทดสอบส่งเข้า LINE
                  </button>
                )}
              </div>

              {sendResult && (
                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  sendResult.success 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {sendResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
                  <span>{sendResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Report Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                ตัวอย่างข้อความที่จะส่งเข้า LINE (วันที่ {selectedDate})
              </span>
              <span className="text-[11px] text-slate-500">
                สินค้าที่ต้องสั่ง: {reorderItems.length} รายการ
              </span>
            </div>
            <pre className="p-3.5 bg-slate-900 text-emerald-400 text-xs font-mono rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-800 max-h-48">
              {previewReport}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            ระบบทำงานอัตโนมัติบน Google Cloud Firestore
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
