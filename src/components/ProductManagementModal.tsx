import React, { useState, useEffect } from 'react';
import { Product } from '../types/inventory';
import { 
  Package, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  X, 
  Check, 
  AlertCircle,
  Truck,
  MapPin,
  Tag,
  ShieldAlert,
  Coins
} from 'lucide-react';
import { formatQty, parseQty } from '../utils/numberFormat';

interface ProductManagementModalProps {
  products: Product[];
  categories: string[];
  suppliers: string[];
  locations: string[];
  editingProduct: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProduct: (id: string, updates: Partial<Product>) => void;
  onDeleteProduct: (id: string) => void;
}

export const ProductManagementModal: React.FC<ProductManagementModalProps> = ({
  products,
  categories,
  suppliers,
  locations,
  editingProduct,
  isOpen,
  onClose,
  onSaveProduct,
  onUpdateProduct,
  onDeleteProduct,
}) => {
  // Mode: 'list' | 'form'
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [search, setSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    id: '',
    sku: '',
    name: '',
    category: '',
    supplier: '',
    location: '',
    unit: 'ชิ้น',
    minStock: 10,
    unitCost: 0,
    notes: '',
  });

  const [formError, setFormError] = useState('');

  // Common units in Thai
  const commonUnits = ['ชิ้น', 'กล่อง', 'แพ็ค', 'ขวด', 'ลัง', 'ถุง', 'ถาด', 'กิโลกรัม', 'แกลลอน', 'ม้วน'];

  // Setup form when editingProduct changes
  useEffect(() => {
    if (editingProduct) {
      setFormData({
        id: editingProduct.id,
        sku: editingProduct.sku,
        name: editingProduct.name,
        category: editingProduct.category,
        supplier: editingProduct.supplier,
        location: editingProduct.location,
        unit: editingProduct.unit,
        minStock: editingProduct.minStock,
        unitCost: editingProduct.unitCost || 0,
        notes: editingProduct.notes || '',
      });
      setMode('form');
    } else {
      setFormData({
        id: '',
        sku: `SKU-${Date.now().toString().slice(-4)}`,
        name: '',
        category: categories[0] || 'สินค้าทั่วไป',
        supplier: suppliers[0] || 'ผู้จำหน่ายหลัก',
        location: locations[0] || 'คลังสินค้าหลัก',
        unit: 'ชิ้น',
        minStock: 10,
        unitCost: 0,
        notes: '',
      });
    }
    setFormError('');
  }, [editingProduct, categories, suppliers, locations, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('กรุณากรอกชื่อสินค้า');
      return;
    }
    if (!formData.unit.trim()) {
      setFormError('กรุณาระบุหน่วยนับของสินค้า (เช่น ชิ้น, กล่อง, ลัง)');
      return;
    }
    if (formData.minStock < 0) {
      setFormError('เกณฑ์ขั้นต่ำต้องไม่ติดลบ');
      return;
    }

    if (formData.id) {
      // Update existing
      onUpdateProduct(formData.id, {
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        category: formData.category.trim(),
        supplier: formData.supplier.trim(),
        location: formData.location.trim(),
        unit: formData.unit.trim(),
        minStock: parseQty(formData.minStock),
        unitCost: parseQty(formData.unitCost),
        notes: formData.notes.trim(),
      });
    } else {
      // Create new
      onSaveProduct({
        name: formData.name.trim(),
        sku: formData.sku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        category: formData.category.trim() || 'สินค้าทั่วไป',
        supplier: formData.supplier.trim() || 'ผู้จำหน่ายหลัก',
        location: formData.location.trim() || 'คลังสินค้าหลัก',
        unit: formData.unit.trim(),
        minStock: parseQty(formData.minStock),
        unitCost: parseQty(formData.unitCost),
        notes: formData.notes.trim(),
      });
    }

    setMode('list');
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {mode === 'form'
                  ? formData.id
                    ? 'แก้ไขรายการสินค้า & หน่วยนับ'
                    : 'เพิ่มรายการสินค้าใหม่'
                  : 'จัดการฐานข้อมูลรายการสินค้า'}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === 'form'
                  ? 'แก้ไขชื่อ, หน่วยนับ, เกณฑ์ขั้นต่ำ, ผู้จำหน่าย และที่อยู่สินค้า'
                  : `มีสินค้าทั้งหมด ${products.length} รายการในระบบ`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {mode === 'list' ? (
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    id: '',
                    sku: `SKU-${Date.now().toString().slice(-4)}`,
                    name: '',
                    category: categories[0] || 'สินค้าทั่วไป',
                    supplier: suppliers[0] || 'ผู้จำหน่ายหลัก',
                    location: locations[0] || 'คลังสินค้าหลัก',
                    unit: 'ชิ้น',
                    minStock: 10,
                    unitCost: 0,
                    notes: '',
                  });
                  setFormError('');
                  setMode('form');
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มสินค้า</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode('list')}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                กลับหน้ารายการ
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {mode === 'form' ? (
            /* Product Add/Edit Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* SKU */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสสินค้า / SKU
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="เช่น BEV-001"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                {/* Product Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อสินค้า <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="เช่น น้ำดื่มสิงห์ 600 มล."
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                {/* Unit of measure */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หน่วยของสินค้า (Unit) <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="เช่น ชิ้น, กล่อง, แพ็ค, ลัง, แกลลอน"
                      required
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      {commonUnits.map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setFormData({ ...formData, unit: u })}
                          className={`px-1.5 py-0.5 rounded border transition-colors ${
                            formData.unit === u
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Min stock threshold */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    จำนวนเกณฑ์ขั้นต่ำที่ต้องสั่ง (Min Threshold){' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.minStock}
                    onChange={(e) =>
                      setFormData({ ...formData, minStock: Math.max(0, parseFloat(e.target.value) || 0) })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold text-amber-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    เมื่อสต็อกคงเหลือ ≤ จำนวนนี้ ระบบจะแจ้งเตือนและนำเข้าใบสรุปสั่งของเพิ่ม (รองรับทศนิยม 2 ตำแหน่ง)
                  </p>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หมวดหมู่สินค้า
                  </label>
                  <input
                    type="text"
                    list="category-suggestions"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="เช่น เครื่องดื่ม, วัตถุดิบ, บรรจุภัณฑ์"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <datalist id="category-suggestions">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                {/* Supplier */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ผู้จำหน่าย (Supplier)
                  </label>
                  <input
                    type="text"
                    list="supplier-suggestions"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="เช่น บจก. บุญรอดบริวเวอรี่"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <datalist id="supplier-suggestions">
                    {suppliers.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                {/* Storage Location */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ที่อยู่ของสินค้า / ตำแหน่งจัดเก็บ (Location)
                  </label>
                  <input
                    type="text"
                    list="location-suggestions"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="เช่น คลังสินค้าหลัก - โซน A1, ชั้นวาง B2"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <datalist id="location-suggestions">
                    {locations.map((loc) => (
                      <option key={loc} value={loc} />
                    ))}
                  </datalist>
                </div>

                {/* Unit Cost */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ราคาต้นทุนต่อหน่วย (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.unitCost}
                    onChange={(e) =>
                      setFormData({ ...formData, unitCost: Math.max(0, parseFloat(e.target.value) || 0) })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หมายเหตุเพิ่มเติม / ขนาดบรรจุ
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="เช่น 1 ลังบรรจุ 24 ชิ้น, สั่งเฉพาะวันจันทร์"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                {formData.id ? (
                  deleteConfirmId === formData.id ? (
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteProduct(formData.id);
                          setDeleteConfirmId(null);
                          setMode('list');
                        }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-xs"
                      >
                        ยืนยันลบสินค้านี้
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2.5 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(formData.id)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors border border-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>ลบสินค้านี้</span>
                    </button>
                  )
                ) : (
                  <div />
                )}

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setMode('list')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>บันทึกข้อมูลสินค้า</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Product List Table */
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาสินค้าเพื่อแก้ไข..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white"
                />
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-900 text-sm">{p.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {p.sku}
                        </span>
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">
                          หน่วย: {p.unit}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500 mt-1">
                        <span>ขั้นต่ำ: <strong className="text-slate-800">{formatQty(p.minStock)} {p.unit}</strong></span>
                        <span>•</span>
                        <span>ตำแหน่ง: {p.location}</span>
                        <span>•</span>
                        <span>ผู้จำหน่าย: {p.supplier}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            id: p.id,
                            sku: p.sku,
                            name: p.name,
                            category: p.category,
                            supplier: p.supplier,
                            location: p.location,
                            unit: p.unit,
                            minStock: p.minStock,
                            unitCost: p.unitCost || 0,
                            notes: p.notes || '',
                          });
                          setFormError('');
                          setMode('form');
                        }}
                        className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>แก้ไข</span>
                      </button>

                      {deleteConfirmId === p.id ? (
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteProduct(p.id);
                              setDeleteConfirmId(null);
                            }}
                            className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded"
                          >
                            ยืนยันลบ
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(p.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบสินค้า"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
