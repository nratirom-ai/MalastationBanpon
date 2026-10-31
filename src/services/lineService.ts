import { Product, ReorderItem } from '../types/inventory';
import { formatQty, formatCurrency } from '../utils/numberFormat';
import { recordStockLog } from './firebaseFirestore';

export interface LineStockReportPayload {
  date: string;
  totalProducts: number;
  countedCount: number;
  reorderItems: ReorderItem[];
  normalCount: number;
  outOfStockCount: number;
  criticalCount: number;
}

/**
 * Builds a clear, professional Thai-formatted message for LINE
 */
export function buildLineStockReport(payload: LineStockReportPayload): string {
  const {
    date,
    totalProducts,
    countedCount,
    reorderItems,
    normalCount,
    outOfStockCount,
    criticalCount,
  } = payload;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  let text = `📦 สรุปสต็อกสินค้าคงเหลือประจำวัน\n`;
  text += `📅 วันที่: ${date} (อัปเดต ${timeStr} น.)\n`;
  text += `───────────────────\n`;
  text += `📊 ภาพรวมการนับสต็อก:\n`;
  text += `• สินค้าทั้งหมด: ${totalProducts} รายการ\n`;
  text += `• บันทึกยอดแล้ว: ${countedCount} รายการ\n`;
  text += `• 🟢 ปกติเพียงพอ: ${normalCount} รายการ\n`;
  text += `• 🟡 ใกล้หมด/ถึงเกณฑ์: ${reorderItems.length} รายการ\n`;
  if (outOfStockCount > 0) {
    text += `• 🔴 หมดสต็อก (0): ${outOfStockCount} รายการ\n`;
  }
  text += `───────────────────\n`;

  if (reorderItems.length === 0) {
    text += `✅ ทุกรายการสต็อกเพียงพอ ไม่มีรายการต้องสั่งเพิ่ม\n`;
  } else {
    text += `⚠️ รายการที่ต้องสั่งซื้อเพิ่ม (${reorderItems.length} รายการ):\n\n`;

    const totalCost = reorderItems.reduce((sum, item) => sum + item.estimatedCost, 0);

    reorderItems.slice(0, 15).forEach((item, index) => {
      const icon = item.currentStock === 0 ? '🔴' : '🟡';
      text += `${index + 1}. ${icon} ${item.product.name}\n`;
      text += `   เหลือ: ${formatQty(item.currentStock)} ${item.product.unit} (ขั้นต่ำ ${formatQty(item.minStock)})\n`;
      text += `   👉 สั่งเพิ่ม: +${formatQty(item.reorderQuantity)} ${item.product.unit}`;
      if (item.estimatedCost > 0) {
        text += ` (~${formatCurrency(item.estimatedCost)} บ.)`;
      }
      text += `\n`;
    });

    if (reorderItems.length > 15) {
      text += `... และอีก ${reorderItems.length - 15} รายการ\n`;
    }

    if (totalCost > 0) {
      text += `\n💰 ยอดสั่งซื้อประมาณการรวม: ${formatCurrency(totalCost)} บาท\n`;
    }
  }

  text += `───────────────────\n`;
  text += `📲 ซิงค์ข้อมูลอัตโนมัติจากระบบ Daily Stock Inventory Web App`;

  return text;
}

/**
 * Builds an instant shortage alert for a single product
 */
export function buildLineInstantAlert(product: Product, currentStock: number): string {
  const isZero = currentStock === 0;
  const icon = isZero ? '🚨 [ด่วนที่สุด สินค้าหมด]' : '⚠️ [แจ้งเตือน สินค้าถึงจุดสั่งซื้อ]';
  const needQty = Math.max(0, product.minStock - currentStock);

  let text = `${icon}\n`;
  text += `📦 วัตถุดิบ/สินค้า: ${product.name}\n`;
  text += `🔢 ยอดคงเหลือ: ${formatQty(currentStock)} ${product.unit}\n`;
  text += `📉 เกณฑ์ขั้นต่ำ: ${formatQty(product.minStock)} ${product.unit}\n`;
  text += `👉 ต้องสั่งเพิ่ม: +${formatQty(needQty)} ${product.unit}\n`;
  if (product.location) text += `📍 ที่อยู่สินค้า: ${product.location}\n`;
  if (product.supplier) text += `🏢 ซัพพลายเออร์: ${product.supplier}\n`;
  text += `⏰ เวลาที่บันทึก: ${new Date().toLocaleTimeString('th-TH')}\n`;
  text += `📲 อัปเดตจากระบบนับสต็อกแบบเรียลไทม์`;

  return text;
}

/**
 * Open LINE app directly with message (Works on Mobile iOS/Android, iPad, and PC LINE Desktop)
 */
export function openLineShare(message: string): void {
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
  window.open(lineUrl, '_blank');
  recordStockLog('line_sync', 'แชร์ข้อมูลสต็อกเข้าสู่ LINE สำเร็จ');
}

/**
 * Send notification to LINE Notify API or custom webhook
 */
export async function sendLineNotify(
  tokenOrWebhook: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  if (!tokenOrWebhook || !tokenOrWebhook.trim()) {
    return {
      success: false,
      message: 'กรุณากรอก LINE Notify Token หรือ Webhook URL',
    };
  }

  const cleanTarget = tokenOrWebhook.trim();

  // If it's a URL (e.g. Google Apps Script, Make, Zapier, or LINE Bot Webhook)
  if (cleanTarget.startsWith('http://') || cleanTarget.startsWith('https://')) {
    try {
      const response = await fetch(cleanTarget, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        await recordStockLog('line_sync', 'ส่งการแจ้งเตือนไปยัง LINE Webhook เรียบร้อย');
        return { success: true, message: 'ส่งข้อความเข้า LINE Webhook สำเร็จแล้ว' };
      }
    } catch (err: any) {
      console.warn('Webhook POST error:', err);
    }
  }

  // If it is a LINE Notify Token
  // Note: LINE Notify API has CORS restrictions on direct browser fetch
  // We try sending; if blocked by CORS or error, we log and provide instant 1-click LINE app share
  try {
    const formData = new URLSearchParams();
    formData.append('message', `\n${message}`);

    const res = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanTarget}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      mode: 'cors',
    });

    if (res.ok) {
      await recordStockLog('line_sync', 'ส่งการแจ้งเตือนผ่าน LINE Notify API สำเร็จ');
      return { success: true, message: 'ส่งการแจ้งเตือนไปยังกลุ่ม LINE สำเร็จแล้ว' };
    }
  } catch (corsErr) {
    console.info('Direct browser call to LINE Notify restricted by browser CORS. Opening LINE Direct Share...');
  }

  // Graceful delivery: launch 1-click LINE Share
  openLineShare(message);
  return {
    success: true,
    message: 'เปิด LINE เพื่อแชร์ข้อมูลเรียบร้อยแล้ว (LINE Share พร้อมส่งทันที)',
  };
}
