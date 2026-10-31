import React, { useState, useMemo } from 'react';
import { Product, DailyCountRecord } from '../types/inventory';
import { 
  BarChart3, 
  Calendar, 
  FileSpreadsheet, 
  Download, 
  TrendingDown, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  Layers,
  ChevronRight,
  Filter
} from 'lucide-react';
import { getTodayString } from '../data/initialData';
import { formatQty } from '../utils/numberFormat';

interface ReportsModalProps {
  products: Product[];
  dailyCounts: DailyCountRecord[];
  onOpenSheetsSync: (type: 'daily' | 'monthly' | 'yearly', dateParam: string) => void;
}

export const ReportsModal: React.FC<ReportsModalProps> = ({
  products,
  dailyCounts,
  onOpenSheetsSync,
}) => {
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7) // YYYY-MM
  );
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Category filter for reports
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Daily Report calculations
  const dailyReportData = useMemo(() => {
    // Yesterday
    const prevDateObj = new Date(selectedDate);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDateStr = prevDateObj.toISOString().split('T')[0];

    const prevCountsMap = new Map<string, number>();
    const currCountsMap = new Map<string, number>();

    dailyCounts.forEach((c) => {
      if (c.date === prevDateStr) prevCountsMap.set(c.productId, c.quantity);
      if (c.date === selectedDate) currCountsMap.set(c.productId, c.quantity);
    });

    const items = products
      .filter((p) => filterCategory === 'ALL' || p.category === filterCategory)
      .map((p) => {
        const todayQty = currCountsMap.get(p.id) ?? null;
        const prevQty = prevCountsMap.get(p.id) ?? null;
        const diff = todayQty !== null && prevQty !== null ? todayQty - prevQty : null;
        const isBelowMin = todayQty !== null && todayQty <= p.minStock;
        const isOutOfStock = todayQty !== null && todayQty === 0;

        return {
          product: p,
          todayQty,
          prevQty,
          diff,
          isBelowMin,
          isOutOfStock,
        };
      });

    const countedCount = items.filter((i) => i.todayQty !== null).length;
    const belowMinCount = items.filter((i) => i.isBelowMin).length;
    const outOfStockCount = items.filter((i) => i.isOutOfStock).length;

    return {
      date: selectedDate,
      items,
      totalItems: items.length,
      countedCount,
      belowMinCount,
      outOfStockCount,
    };
  }, [products, dailyCounts, selectedDate, filterCategory]);

  // Monthly Report calculations
  const monthlyReportData = useMemo(() => {
    // Filter records in selectedMonth (YYYY-MM)
    const monthCounts = dailyCounts.filter((c) => c.date.startsWith(selectedMonth));
    
    // Group counts by product
    const productStats = products
      .filter((p) => filterCategory === 'ALL' || p.category === filterCategory)
      .map((p) => {
        const records = monthCounts.filter((c) => c.productId === p.id);
        const quantities = records.map((r) => r.quantity);
        const count = quantities.length;
        const avg = count > 0 ? quantities.reduce((a, b) => a + b, 0) / count : null;
        const minRecorded = count > 0 ? Math.min(...quantities) : null;
        const maxRecorded = count > 0 ? Math.max(...quantities) : null;
        // Last recorded in month
        const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
        const endOfMonthQty = sorted.length > 0 ? sorted[0].quantity : null;

        return {
          product: p,
          recordDays: count,
          avg: avg !== null ? Math.round(avg * 10) / 10 : null,
          minRecorded,
          maxRecorded,
          endOfMonthQty,
          belowMinCount: quantities.filter((q) => q <= p.minStock).length,
        };
      });

    return {
      month: selectedMonth,
      productStats,
    };
  }, [products, dailyCounts, selectedMonth, filterCategory]);

  // Yearly Report calculations
  const yearlyReportData = useMemo(() => {
    const yearCounts = dailyCounts.filter((c) => c.date.startsWith(String(selectedYear)));

    // Generate 12 months array
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthNum = String(i + 1).padStart(2, '0');
      const prefix = `${selectedYear}-${monthNum}`;
      const recs = yearCounts.filter((c) => c.date.startsWith(prefix));
      const totalUnits = recs.reduce((acc, c) => acc + c.quantity, 0);
      const avg = recs.length > 0 ? Math.round(totalUnits / recs.length) : 0;
      const countsCount = recs.length;

      return {
        month: monthNum,
        monthName: [
          'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
          'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
        ][i],
        avgStock: avg,
        totalRecords: countsCount,
      };
    });

    const productYearly = products
      .filter((p) => filterCategory === 'ALL' || p.category === filterCategory)
      .map((p) => {
        const recs = yearCounts.filter((c) => c.productId === p.id);
        const count = recs.length;
        const avg = count > 0 ? Math.round((recs.reduce((a, b) => a + b.quantity, 0) / count) * 10) / 10 : null;
        return {
          product: p,
          yearlyAvg: avg,
          totalCountsRecorded: count,
        };
      });

    return {
      year: selectedYear,
      months,
      productYearly,
    };
  }, [products, dailyCounts, selectedYear, filterCategory]);

  // Export to CSV helper
  const handleDownloadCSV = () => {
    let csvContent = '\uFEFF'; // UTF-8 BOM for Thai Excel

    if (reportType === 'daily') {
      csvContent += `รายงานสินค้าคงเหลือประจำวัน,วันที่,${dailyReportData.date}\n`;
      csvContent += `รหัส SKU,ชื่อสินค้า,หมวดหมู่,ตำแหน่ง,ผู้จำหน่าย,เกณฑ์ขั้นต่ำ,ยอดเมื่อวาน,ยอดคงเหลือวันนี้,ผลต่าง,สถานะ\n`;
      dailyReportData.items.forEach((item) => {
        const status = item.todayQty === null ? 'ยังไม่นับ' : item.isOutOfStock ? 'หมดสต็อก' : item.isBelowMin ? 'ต่ำกว่าเกณฑ์' : 'ปกติ';
        csvContent += `"${item.product.sku}","${item.product.name}","${item.product.category}","${item.product.location}","${item.product.supplier}",${item.product.minStock},${item.prevQty ?? ''},${item.todayQty ?? ''},${item.diff ?? ''},"${status}"\n`;
      });
    } else if (reportType === 'monthly') {
      csvContent += `รายงานสินค้าคงเหลือประจำเดือน,เดือน,${monthlyReportData.month}\n`;
      csvContent += `รหัส SKU,ชื่อสินค้า,หมวดหมู่,หน่วยนับ,เกณฑ์ขั้นต่ำ,ยอดสิ้นเดือน,ยอดเฉลี่ยรายวัน,ยอดต่ำสุดที่บันทึก,ยอดสูงสุดที่บันทึก,จำนวนวันที่ต่ำกว่าเกณฑ์\n`;
      monthlyReportData.productStats.forEach((stat) => {
        csvContent += `"${stat.product.sku}","${stat.product.name}","${stat.product.category}","${stat.product.unit}",${stat.product.minStock},${stat.endOfMonthQty ?? ''},${stat.avg ?? ''},${stat.minRecorded ?? ''},${stat.maxRecorded ?? ''},${stat.belowMinCount}\n`;
      });
    } else {
      csvContent += `รายงานสินค้าคงเหลือประจำปี,ปี พ.ศ./ค.ศ.,${yearlyReportData.year}\n`;
      csvContent += `รหัส SKU,ชื่อสินค้า,หมวดหมู่,หน่วยนับ,เกณฑ์ขั้นต่ำ,ยอดเฉลี่ยทั้งปี,จำนวนครั้งที่บันทึก\n`;
      yearlyReportData.productYearly.forEach((item) => {
        csvContent += `"${item.product.sku}","${item.product.name}","${item.product.category}","${item.product.unit}",${item.product.minStock},${item.yearlyAvg ?? ''},${item.totalCountsRecorded}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Stock_Report_${reportType}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                รายงานสินค้าคงเหลือ (Stock Reports)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              เรียกดูสถิติและประวัติสต็อกย้อนหลังแบบ รายวัน, รายเดือน, และรายปี พร้อมส่งออก
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ดาวน์โหลด CSV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const dateParam =
                  reportType === 'daily'
                    ? selectedDate
                    : reportType === 'monthly'
                    ? selectedMonth
                    : String(selectedYear);
                onOpenSheetsSync(reportType, dateParam);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>ส่งออกรายงานไป Google Sheets</span>
            </button>
          </div>
        </div>

        {/* Period Selector Tabs & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit">
            <button
              type="button"
              onClick={() => setReportType('daily')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                reportType === 'daily'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายงานรายวัน (Daily)
            </button>
            <button
              type="button"
              onClick={() => setReportType('monthly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                reportType === 'monthly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายงานรายเดือน (Monthly)
            </button>
            <button
              type="button"
              onClick={() => setReportType('yearly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                reportType === 'yearly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายงานรายปี (Yearly)
            </button>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            {reportType === 'daily' && (
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-600 font-medium">เลือกวันที่:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-hidden"
                />
              </div>
            )}

            {reportType === 'monthly' && (
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-600 font-medium">เลือกเดือน:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-hidden"
                />
              </div>
            )}

            {reportType === 'yearly' && (
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-600 font-medium">เลือกปี ค.ศ.:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-hidden"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y} (พ.ศ. {y + 543})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category Filter */}
            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg">
              <Filter className="w-3 h-3 text-slate-400" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-transparent text-slate-800 font-medium focus:outline-hidden"
              >
                <option value="ALL">ทุกหมวดหมู่</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* REPORT VIEW: DAILY */}
      {reportType === 'daily' && (
        <div className="space-y-4">
          {/* Summary widgets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-500 font-medium">รายการทั้งหมด</div>
              <div className="text-lg font-bold text-slate-900">{dailyReportData.totalItems} รายการ</div>
            </div>
            <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100">
              <div className="text-[11px] text-blue-700 font-medium">นับแล้วในวันนี้</div>
              <div className="text-lg font-bold text-blue-900">{dailyReportData.countedCount} รายการ</div>
            </div>
            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-100">
              <div className="text-[11px] text-amber-700 font-medium">ต่ำกว่าเกณฑ์ขั้นต่ำ</div>
              <div className="text-lg font-bold text-amber-900">{dailyReportData.belowMinCount} รายการ</div>
            </div>
            <div className="bg-red-50 p-3.5 rounded-xl border border-red-100">
              <div className="text-[11px] text-red-700 font-medium">หมดสต็อก (0)</div>
              <div className="text-lg font-bold text-red-900">{dailyReportData.outOfStockCount} รายการ</div>
            </div>
          </div>

          {/* Daily Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between items-center">
              <span>ตารางยอดคงเหลือประจำวัน ({selectedDate})</span>
              <span className="text-[11px] font-normal text-slate-500">
                เปรียบเทียบกับยอดวันก่อนหน้า
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/60 border-b border-slate-100 text-[11px] text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">รหัส SKU</th>
                    <th className="px-4 py-2.5">ชื่อสินค้า</th>
                    <th className="px-4 py-2.5">หมวดหมู่</th>
                    <th className="px-4 py-2.5">ที่อยู่จัดเก็บ</th>
                    <th className="px-4 py-2.5 text-center">เกณฑ์ขั้นต่ำ</th>
                    <th className="px-4 py-2.5 text-center">เมื่อวาน</th>
                    <th className="px-4 py-2.5 text-center">ยอดวันนี้</th>
                    <th className="px-4 py-2.5 text-center">ผลต่าง</th>
                    <th className="px-4 py-2.5 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyReportData.items.map((item) => (
                    <tr
                      key={item.product.id}
                      className={`hover:bg-slate-50 ${
                        item.isOutOfStock
                          ? 'bg-red-50/30'
                          : item.isBelowMin
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                        {item.product.sku}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {item.product.name}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{item.product.category}</td>
                      <td className="px-4 py-2.5 text-slate-500">{item.product.location}</td>
                      <td className="px-4 py-2.5 text-center font-medium">
                        {formatQty(item.product.minStock)} {item.product.unit}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-500">
                        {item.prevQty !== null ? `${formatQty(item.prevQty)} ${item.product.unit}` : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-slate-900">
                        {item.todayQty !== null ? (
                          <span
                            className={
                              item.isOutOfStock
                                ? 'text-red-600'
                                : item.isBelowMin
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }
                          >
                            {formatQty(item.todayQty)} {item.product.unit}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal italic">ยังไม่นับ</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold">
                        {item.diff !== null ? (
                          <span
                            className={
                              item.diff > 0
                                ? 'text-emerald-600'
                                : item.diff < 0
                                ? 'text-rose-600'
                                : 'text-slate-400'
                            }
                          >
                            {item.diff > 0 ? `+${item.diff.toFixed(2)}` : item.diff.toFixed(2)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {item.todayQty === null ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500">
                            ยังไม่นับ
                          </span>
                        ) : item.isOutOfStock ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-800 font-bold">
                            หมดสต็อก
                          </span>
                        ) : item.isBelowMin ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900 font-bold">
                            ต่ำกว่าเกณฑ์
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-medium">
                            ปกติ
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT VIEW: MONTHLY */}
      {reportType === 'monthly' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between items-center">
              <span>รายงานวิเคราะห์สต็อกสินค้าประจำเดือน ({monthlyReportData.month})</span>
              <span className="text-[11px] font-normal text-slate-500">
                ประมวลผลจากข้อมูลการนับตลอดทั้งเดือน
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/60 border-b border-slate-100 text-[11px] text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">รหัส SKU</th>
                    <th className="px-4 py-2.5">ชื่อสินค้า</th>
                    <th className="px-4 py-2.5">หมวดหมู่</th>
                    <th className="px-4 py-2.5 text-center">เกณฑ์ขั้นต่ำ</th>
                    <th className="px-4 py-2.5 text-center">ยอดล่าสุดในเดือน</th>
                    <th className="px-4 py-2.5 text-center">ยอดเฉลี่ยรายวัน</th>
                    <th className="px-4 py-2.5 text-center">ต่ำสุด - สูงสุด</th>
                    <th className="px-4 py-2.5 text-center">วันที่ต่ำกว่าเกณฑ์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyReportData.productStats.map((stat) => (
                    <tr key={stat.product.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                        {stat.product.sku}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {stat.product.name}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{stat.product.category}</td>
                      <td className="px-4 py-2.5 text-center font-medium">
                        {formatQty(stat.product.minStock)} {stat.product.unit}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-slate-900">
                        {stat.endOfMonthQty !== null ? (
                          `${formatQty(stat.endOfMonthQty)} ${stat.product.unit}`
                        ) : (
                          <span className="text-slate-400 italic font-normal">ไม่มีข้อมูล</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center font-medium text-blue-700">
                        {stat.avg !== null ? `${formatQty(stat.avg)} ${stat.product.unit}` : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-600">
                        {stat.minRecorded !== null && stat.maxRecorded !== null ? (
                          `${formatQty(stat.minRecorded)} - ${formatQty(stat.maxRecorded)}`
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {stat.belowMinCount > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">
                            {stat.belowMinCount} วัน
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800">
                            0 วัน (ปลอดภัย)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT VIEW: YEARLY */}
      {reportType === 'yearly' && (
        <div className="space-y-4">
          {/* Yearly Chart visualization */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="font-bold text-xs text-slate-700 mb-4 flex items-center justify-between">
              <span>กราฟแนวโน้มสต็อกเฉลี่ยรายเดือน ประจำปี ค.ศ. {yearlyReportData.year}</span>
              <span className="text-[11px] text-slate-400 font-normal">
                หน่วย: ยอดสินค้าคงคลังเฉลี่ย
              </span>
            </h3>

            {/* Visual Bar chart */}
            <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2 border-b border-slate-200">
              {yearlyReportData.months.map((m) => {
                const maxVal = Math.max(1, ...yearlyReportData.months.map((x) => x.avgStock));
                const heightPercent = m.avgStock > 0 ? (m.avgStock / maxVal) * 100 : 4;

                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="text-[10px] font-bold text-slate-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {m.avgStock}
                    </div>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                        m.avgStock > 0
                          ? 'bg-gradient-to-t from-emerald-600 to-teal-400 group-hover:brightness-110'
                          : 'bg-slate-200/60'
                      }`}
                    />
                    <span className="text-[10px] text-slate-500 mt-2 font-medium">
                      {m.monthName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Yearly Product Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
              ตารางสรุปเฉลี่ยรายปี ค.ศ. {yearlyReportData.year}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/60 border-b border-slate-100 text-[11px] text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">รหัส SKU</th>
                    <th className="px-4 py-2.5">ชื่อสินค้า</th>
                    <th className="px-4 py-2.5">หมวดหมู่</th>
                    <th className="px-4 py-2.5 text-center">เกณฑ์ขั้นต่ำ</th>
                    <th className="px-4 py-2.5 text-center">ยอดเฉลี่ยทั้งปี</th>
                    <th className="px-4 py-2.5 text-center">จำนวนวันที่บันทึกในปีนี้</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {yearlyReportData.productYearly.map((item) => (
                    <tr key={item.product.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                        {item.product.sku}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {item.product.name}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{item.product.category}</td>
                      <td className="px-4 py-2.5 text-center font-medium">
                        {formatQty(item.product.minStock)} {item.product.unit}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-emerald-800">
                        {item.yearlyAvg !== null ? `${formatQty(item.yearlyAvg)} ${item.product.unit}` : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-500">
                        {item.totalCountsRecorded} วัน
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
