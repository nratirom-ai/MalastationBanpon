/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useInventory } from './hooks/useInventory';
import { Header } from './components/Header';
import { StockCounter } from './components/StockCounter';
import { ReorderSummary } from './components/ReorderSummary';
import { ReportsModal } from './components/ReportsModal';
import { ProductManagementModal } from './components/ProductManagementModal';
import { NotificationCenter } from './components/NotificationCenter';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { ReorderProductsModal } from './components/ReorderProductsModal';
import { LineSyncModal } from './components/LineSyncModal';
import { OnlineCollaboratorsModal } from './components/OnlineCollaboratorsModal';
import { Product, UserPresence } from './types/inventory';
import { 
  initAuth, 
  googleSignIn, 
  emailSignIn,
  logout, 
  getLocalCollaboratorId, 
  getLocalCollaboratorName, 
  setLocalCollaboratorName,
  getLocalCollaboratorEmail,
  setLocalCollaboratorEmail
} from './services/auth';
import { 
  subscribeToOnlineCollaborators, 
  updateCollaboratorPresence, 
  removeCollaboratorPresence 
} from './services/firebaseFirestore';
import { User } from 'firebase/auth';
import { Package, RotateCcw, AlertTriangle, FileSpreadsheet, Trash2, ArrowUpDown, ChevronUp, ChevronDown, MessageCircle, Users, Wifi, Search, Database } from 'lucide-react';
import { formatQty } from './utils/numberFormat';

export default function App() {
  // User Authentication & Collaborative Presence state
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [collaborators, setCollaborators] = useState<UserPresence[]>([]);
  const [localCollaboratorName, setLocalName] = useState(() => getLocalCollaboratorName() || 'คุณรติรมย์');
  const [localCollaboratorEmail, setLocalEmail] = useState<string | null>(
    () => getLocalCollaboratorEmail() || 'N.Ratirom@gmail.com'
  );
  const [collaboratorId] = useState(() => getLocalCollaboratorId());

  const currentCollaborator = React.useMemo(() => {
    return {
      email: googleUser?.email || localCollaboratorEmail,
      displayName: googleUser?.displayName || localCollaboratorName,
      uid: googleUser?.uid || collaboratorId,
    };
  }, [googleUser, localCollaboratorEmail, localCollaboratorName, collaboratorId]);

  const {
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
  } = useInventory(currentCollaborator);

  // Navigation tab
  const [currentTab, setCurrentTab] = useState<'count' | 'reorder' | 'reports' | 'products'>('count');

  // Modals state
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [isLineSyncModalOpen, setIsLineSyncModalOpen] = useState(false);
  const [isCollaboratorsModalOpen, setIsCollaboratorsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteCatalogConfirmId, setDeleteCatalogConfirmId] = useState<string | null>(null);

  // Search & Filter state for the 139 products catalog tab
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('ALL');

  const filteredCatalog = React.useMemo(() => {
    return products.filter((p) => {
      const q = catalogSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.supplier && p.supplier.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q));
      const matchesCat = catalogCategory === 'ALL' || p.category === catalogCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, catalogSearch, catalogCategory]);

  // Google Sheets integration state
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [sheetsExportConfig, setSheetsExportConfig] = useState<{
    type: 'daily' | 'monthly' | 'yearly' | 'reorder';
    dateParam?: string;
  }>({ type: 'daily' });

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
        if (user.email) setLocalEmail(user.email);
        if (user.displayName) setLocalName(user.displayName);
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Listen to Real-time Online Collaborators in Firestore
  useEffect(() => {
    const unsubscribe = subscribeToOnlineCollaborators((list) => {
      setCollaborators(list);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Heartbeat presence updater
  useEffect(() => {
    const uid = googleUser ? googleUser.uid : collaboratorId;
    const displayName = googleUser
      ? (googleUser.displayName || googleUser.email?.split('@')[0] || 'ผู้ใช้ Google')
      : localCollaboratorName;
    const email = googleUser?.email || localCollaboratorEmail || undefined;
    const photoURL = googleUser?.photoURL || undefined;

    const reportPresence = () => {
      updateCollaboratorPresence({
        uid,
        displayName,
        email,
        photoURL,
        lastActive: new Date().toISOString(),
        status: 'online',
        currentDate: selectedDate,
        currentTab,
        deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
      });
    };

    reportPresence();
    const interval = setInterval(reportPresence, 25000);

    const handleUnload = () => {
      removeCollaboratorPresence(uid);
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [googleUser, collaboratorId, localCollaboratorName, localCollaboratorEmail, selectedDate, currentTab]);

  const handleEmailSignIn = useCallback(async (email: string, displayName?: string, password?: string) => {
    try {
      setIsSigningIn(true);
      const res = await emailSignIn(email, displayName, password);
      if (res?.user) {
        setGoogleUser(res.user);
      }
      setLocalEmail(res.email);
      if (displayName) setLocalName(displayName);
      refreshRealtimeSync();
    } catch (err: any) {
      console.error('Email sign in error:', err);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  }, [refreshRealtimeSync]);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      setIsSigningIn(true);
      const res = await googleSignIn();
      if (res?.user) {
        setGoogleUser(res.user);
        if (res.user.email) setLocalEmail(res.user.email);
        if (res.user.displayName) setLocalName(res.user.displayName);
      }
      refreshRealtimeSync();
    } catch (err: any) {
      console.error('Google sign in error:', err);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  }, [refreshRealtimeSync]);

  const handleSignOut = useCallback(async () => {
    const uid = googleUser?.uid || collaboratorId;
    if (uid) {
      await removeCollaboratorPresence(uid);
    }
    await logout();
    setGoogleUser(null);
    setLocalEmail(null);
    refreshRealtimeSync();
  }, [googleUser, collaboratorId, refreshRealtimeSync]);

  const handleUpdateCollaboratorName = useCallback((name: string) => {
    setLocalCollaboratorName(name);
    setLocalName(name);
  }, []);

  // Keyboard shortcut Ctrl+Z / Cmd+Z for fast Undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        // Only if not actively typing inside an input/textarea
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          undoLastAction();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoLastAction]);

  // Open edit modal for a product
  const handleEditProduct = useCallback((product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  }, []);

  // Open add new product modal
  const handleAddNewProduct = useCallback(() => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  }, []);

  // Select product to focus and count
  const handleSelectProductToCount = useCallback(
    (productId: string) => {
      const p = products.find((x) => x.id === productId);
      if (p) {
        setFilters((prev) => ({
          ...prev,
          searchQuery: p.name,
          status: 'ALL',
        }));
        setCurrentTab('count');
      }
    },
    [products, setFilters]
  );

  // Open Google Sheets export modal with specific report type
  const handleOpenSheetsSyncForReport = useCallback(
    (type: 'daily' | 'monthly' | 'yearly', dateParam: string) => {
      setSheetsExportConfig({ type, dateParam });
      setIsSheetsModalOpen(true);
    },
    []
  );

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        undoCount={undoStack.length}
        onUndo={undoLastAction}
        lastUndoMessage={lastUndoMessage}
        alertCount={stockAlerts.length}
        onOpenNotifications={() => setIsNotificationOpen(true)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        onOpenSheetsSync={() => {
          setSheetsExportConfig({
            type: currentTab === 'reorder' ? 'reorder' : 'daily',
            dateParam: selectedDate,
          });
          setIsSheetsModalOpen(true);
        }}
        isSheetsConnected={!!googleUser}
        userEmail={googleUser?.email || localCollaboratorEmail}
        onOpenLineSync={() => setIsLineSyncModalOpen(true)}
        isFirestoreConnected={syncStatus.isFirestoreConnected}
        currentUser={googleUser}
        collaborators={collaborators}
        onOpenCollaborators={() => setIsCollaboratorsModalOpen(true)}
        onGoogleSignIn={() => setIsCollaboratorsModalOpen(true)}
        onSignOut={handleSignOut}
        isSigningIn={isSigningIn}
        collaboratorName={localCollaboratorName}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {currentTab === 'count' && (
          <StockCounter
            products={products}
            dailyCounts={dailyCounts}
            selectedDate={selectedDate}
            filters={filters}
            setFilters={setFilters}
            categories={categories}
            suppliers={suppliers}
            locations={locations}
            getProductStockOnDate={getProductStockOnDate}
            getPreviousStockBeforeDate={getPreviousStockBeforeDate}
            onUpdateStock={updateProductStock}
            onAdjustStock={adjustProductStock}
            onEditProduct={handleEditProduct}
            onDeleteProduct={deleteProduct}
            onAddNewProduct={handleAddNewProduct}
            onResetDayStockToZero={resetDayStockToZero}
            onMoveProduct={moveProduct}
            onOpenReorderModal={() => setIsReorderModalOpen(true)}
            onOpenLineSync={() => setIsLineSyncModalOpen(true)}
            onUndo={undoLastAction}
            undoCount={undoStack.length}
            lastUndoMessage={lastUndoMessage}
            onOpenCollaborators={() => setIsCollaboratorsModalOpen(true)}
            collaboratorsCount={collaborators.length}
            userEmail={googleUser?.email || localCollaboratorEmail}
            onRefreshSync={refreshRealtimeSync}
            isFirestoreConnected={syncStatus.isFirestoreConnected}
          />
        )}

        {currentTab === 'reorder' && (
          <ReorderSummary
            reorderItems={reorderItems}
            selectedDate={selectedDate}
            onOpenSheetsSync={() => {
              setSheetsExportConfig({ type: 'reorder', dateParam: selectedDate });
              setIsSheetsModalOpen(true);
            }}
            onSelectProductToCount={handleSelectProductToCount}
            onOpenLineSync={() => setIsLineSyncModalOpen(true)}
          />
        )}

        {currentTab === 'reports' && (
          <ReportsModal
            products={products}
            dailyCounts={dailyCounts}
            onOpenSheetsSync={handleOpenSheetsSyncForReport}
          />
        )}

        {currentTab === 'products' && (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-slate-900">
                    ฐานข้อมูลสินค้า ({products.length} รายการ)
                  </h2>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
                    พร้อมไฟล์ CSV 139 รายการ
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  แก้ไขชื่อสินค้า, หน่วยนับ, เกณฑ์ขั้นต่ำ, ผู้จำหน่าย, ที่อยู่จัดเก็บ และปรับลำดับวัตถุดิบ
                </p>
              </div>
              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsReorderModalOpen(true)}
                  className="px-3.5 py-1.5 bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-2xs transition-colors flex items-center space-x-1.5"
                  title="ปรับเปลี่ยนลำดับการแสดงผลของวัตถุดิบทั้งหมด"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600" />
                  <span>จัดเรียงลำดับสินค้า</span>
                </button>
                <button
                  type="button"
                  onClick={resetToSampleData}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                  title="นำเข้าและรีเซ็ตสินค้า 139 รายการจากไฟล์ CSV"
                >
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  <span>นำเข้า 139 รายการจากไฟล์ CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddNewProduct}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  + เพิ่มสินค้าใหม่
                </button>
              </div>
            </div>

            {/* Catalog Search & Category Filters */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อสินค้า, SKU, ผู้จำหน่าย, หรือตำแหน่งจัดเก็บ..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
                {catalogSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <span className="text-slate-500 whitespace-nowrap">หมวดหมู่:</span>
                <select
                  value={catalogCategory}
                  onChange={(e) => setCatalogCategory(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">ทุกหมวดหมู่ ({products.length})</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c} ({products.filter((p) => p.category === c).length})
                    </option>
                  ))}
                </select>
                {(catalogSearch || catalogCategory !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogSearch('');
                      setCatalogCategory('ALL');
                    }}
                    className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
                  >
                    ล้างการค้นหา
                  </button>
                )}
              </div>
            </div>

            {/* Render full table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-3 text-center w-20">ลำดับ</th>
                      <th className="px-4 py-3">รหัส SKU</th>
                      <th className="px-4 py-3">ชื่อสินค้า</th>
                      <th className="px-4 py-3">หมวดหมู่</th>
                      <th className="px-4 py-3">ที่อยู่จัดเก็บ (Location)</th>
                      <th className="px-4 py-3">ผู้จำหน่าย (Supplier)</th>
                      <th className="px-4 py-3 text-center">หน่วยนับ</th>
                      <th className="px-4 py-3 text-center">เกณฑ์ขั้นต่ำ (Min)</th>
                      <th className="px-4 py-3 text-center">ราคาต่อหน่วย</th>
                      <th className="px-4 py-3 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCatalog.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-slate-400">
                          ไม่พบสินค้าที่ตรงกับคำค้นหา
                        </td>
                      </tr>
                    ) : (
                      filteredCatalog.map((p, index) => {
                        const originalIndex = products.findIndex((x) => x.id === p.id);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <span className="font-mono text-xs font-bold text-slate-600 w-7 text-center bg-slate-100 py-0.5 rounded">
                                  #{originalIndex !== -1 ? originalIndex + 1 : index + 1}
                                </span>
                                <div className="flex flex-col -space-y-1">
                                  <button
                                    type="button"
                                    disabled={originalIndex <= 0}
                                    onClick={() => moveProduct(p.id, 'up')}
                                    className={`p-0.5 rounded transition-colors ${
                                      originalIndex <= 0
                                        ? 'text-slate-300 cursor-not-allowed opacity-30'
                                        : 'text-slate-500 hover:text-emerald-700 hover:bg-slate-200'
                                    }`}
                                    title="ย้ายขึ้น 1 ลำดับ"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={originalIndex === -1 || originalIndex >= products.length - 1}
                                    onClick={() => moveProduct(p.id, 'down')}
                                    className={`p-0.5 rounded transition-colors ${
                                      originalIndex === -1 || originalIndex >= products.length - 1
                                        ? 'text-slate-300 cursor-not-allowed opacity-30'
                                        : 'text-slate-500 hover:text-emerald-700 hover:bg-slate-200'
                                    }`}
                                    title="ย้ายลง 1 ลำดับ"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{p.sku}</td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                            <td className="px-4 py-3">
                              <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full text-[10px] font-medium border border-teal-100">
                                {p.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{p.location}</td>
                            <td className="px-4 py-3 text-slate-600">{p.supplier}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{p.unit}</td>
                            <td className="px-4 py-3 text-center font-bold text-amber-800">
                              {formatQty(p.minStock)} {p.unit}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-600">
                              {p.unitCost > 0 ? `฿${p.unitCost}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleEditProduct(p)}
                                  className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors cursor-pointer"
                                >
                                  แก้ไข
                                </button>

                                {deleteCatalogConfirmId === p.id ? (
                                  <div className="flex items-center space-x-1 animate-fadeIn">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        deleteProduct(p.id);
                                        setDeleteCatalogConfirmId(null);
                                      }}
                                      className="px-2.5 py-1 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                                      title="ยืนยันการลบ"
                                    >
                                      ยืนยันลบ
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteCatalogConfirmId(null)}
                                      className="px-2 py-1 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteCatalogConfirmId(p.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="ลบสินค้านี้"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Product Management Modal */}
      <ProductManagementModal
        products={products}
        categories={categories}
        suppliers={suppliers}
        locations={locations}
        editingProduct={editingProduct}
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        onSaveProduct={(data) => {
          addProduct(data);
          setIsProductModalOpen(false);
        }}
        onUpdateProduct={(id, updates) => {
          updateProduct(id, updates);
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        onDeleteProduct={(id) => {
          deleteProduct(id);
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
      />

      {/* Reorder Products Modal */}
      <ReorderProductsModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        products={products}
        onSaveOrder={reorderProducts}
        onSortPreset={sortProductsBy}
      />

      {/* Real-time Notification Center Drawer */}
      <NotificationCenter
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        alerts={stockAlerts}
        onSelectProduct={handleSelectProductToCount}
        onOpenReorder={() => setCurrentTab('reorder')}
      />

      {/* Google Sheets Sync Modal */}
      <GoogleSheetsSyncModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        user={googleUser}
        setUser={setGoogleUser}
        products={products}
        dailyCounts={dailyCounts}
        reorderItems={reorderItems}
        selectedDate={selectedDate}
        defaultExportType={sheetsExportConfig.type}
        dateParam={sheetsExportConfig.dateParam}
      />

      {/* LINE & Real-time Web App Sync Modal */}
      <LineSyncModal
        isOpen={isLineSyncModalOpen}
        onClose={() => setIsLineSyncModalOpen(false)}
        syncStatus={syncStatus}
        lineSettings={lineSettings}
        onUpdateLineSettings={updateLineSettings}
        selectedDate={selectedDate}
        products={products}
        reorderItems={reorderItems}
        getProductStockOnDate={getProductStockOnDate}
      />

      {/* Online Collaborators & Live Team Multi-user Modal */}
      <OnlineCollaboratorsModal
        isOpen={isCollaboratorsModalOpen}
        onClose={() => setIsCollaboratorsModalOpen(false)}
        collaborators={collaborators}
        currentUser={googleUser}
        localCollaboratorName={localCollaboratorName}
        localCollaboratorEmail={localCollaboratorEmail}
        onUpdateCollaboratorName={handleUpdateCollaboratorName}
        onGoogleSignIn={handleGoogleSignIn}
        onEmailSignIn={handleEmailSignIn}
        onSignOut={handleSignOut}
        onRefreshSync={refreshRealtimeSync}
        isSigningIn={isSigningIn}
        selectedDate={selectedDate}
        isFirestoreConnected={syncStatus.isFirestoreConnected}
      />

      {/* Persistent Real-time Sync Status & Online Collaborators Pill (Bottom Corner) */}
      <aside aria-label="สถานะการเชื่อมต่อระบบ" className="fixed bottom-4 right-4 z-40 hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-full shadow-md text-xs">
        <button
          type="button"
          onClick={() => setIsCollaboratorsModalOpen(true)}
          className="flex items-center gap-1.5 text-teal-700 hover:text-teal-900 pr-2 border-r border-slate-200 transition-colors cursor-pointer"
          title="ดูผู้ร่วมแก้ไขออนไลน์ขณะนี้"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Users className="w-3.5 h-3.5 text-teal-600" />
          <span className="font-semibold text-[11px]">
            {collaborators.length} คนออนไลน์ (แก้ไขพร้อมกันได้)
          </span>
        </button>

        <button
          type="button"
          onClick={() => setIsLineSyncModalOpen(true)}
          className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer"
          title="สถานะการซิงค์ข้อมูลกับ LINE และ Real-time Database"
        >
          <span className="font-medium text-[11px]">
            {syncStatus.isFirestoreConnected ? 'ซิงค์เรียลไทม์' : 'โหมดบันทึกในเครื่อง'}
          </span>
          <MessageCircle className="w-3.5 h-3.5 text-[#06C755]" />
        </button>
      </aside>
    </div>
  );
}

