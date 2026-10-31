import React, { useState } from 'react';
import { 
  Calendar, 
  RotateCcw, 
  Bell, 
  Volume2, 
  VolumeX, 
  FileSpreadsheet, 
  Layers, 
  ClipboardList, 
  ShoppingCart, 
  BarChart3, 
  PackagePlus,
  CheckCircle2,
  MessageCircle,
  Users,
  LogIn,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { getTodayString, getOffsetDateString } from '../data/initialData';
import { User } from 'firebase/auth';
import { UserPresence } from '../types/inventory';

interface HeaderProps {
  currentTab: 'count' | 'reorder' | 'reports' | 'products';
  setCurrentTab: (tab: 'count' | 'reorder' | 'reports' | 'products') => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  undoCount: number;
  onUndo: () => void;
  lastUndoMessage: string | null;
  alertCount: number;
  onOpenNotifications: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenSheetsSync: () => void;
  isSheetsConnected: boolean;
  userEmail?: string | null;
  onOpenLineSync?: () => void;
  isFirestoreConnected?: boolean;
  currentUser?: User | null;
  collaborators?: UserPresence[];
  onOpenCollaborators?: () => void;
  onGoogleSignIn?: () => void;
  onSignOut?: () => void;
  isSigningIn?: boolean;
  collaboratorName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  selectedDate,
  setSelectedDate,
  undoCount,
  onUndo,
  lastUndoMessage,
  alertCount,
  onOpenNotifications,
  soundEnabled,
  onToggleSound,
  onOpenSheetsSync,
  isSheetsConnected,
  userEmail,
  onOpenLineSync,
  isFirestoreConnected = true,
  currentUser,
  collaborators = [],
  onOpenCollaborators,
  onGoogleSignIn,
  onSignOut,
  isSigningIn = false,
  collaboratorName = 'ผู้ร่วมตรวจสต็อก',
}) => {
  const today = getTodayString();
  const yesterday = getOffsetDateString(-1);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
          {/* Logo & title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  ระบบนับสต็อกสินค้าประจำวัน
                </h1>
                <span className="hidden sm:inline-block text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Daily Stock Tracker
                </span>
              </div>
              <p className="text-xs text-slate-500">
                นับสต็อกคงเหลือ เช็คเกณฑ์ขั้นต่ำ สรุปสั่งของเพิ่ม และส่งออก Google Sheets
              </p>
            </div>
          </div>

          {/* Quick Actions (Date selector, Undo, Notifications, Google Sheets) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Picker & Quick Days */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-500 ml-1.5 mr-1" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
              />
              <div className="h-4 w-px bg-slate-300 mx-1.5" />
              <button
                type="button"
                onClick={() => setSelectedDate(today)}
                className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
                  selectedDate === today
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(yesterday)}
                className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
                  selectedDate === yesterday
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                เมื่อวาน
              </button>
            </div>

            {/* Undo Button (ย้อนกลับรายการล่าสุด) */}
            <div className="relative group">
              <button
                type="button"
                onClick={onUndo}
                disabled={undoCount === 0}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  undoCount > 0
                    ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 active:scale-95 shadow-xs'
                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                title={undoCount > 0 ? 'ย้อนการกระทำล่าสุด (Undo)' : 'ยังไม่มีประวัติให้ย้อน'}
              >
                <RotateCcw className={`w-3.5 h-3.5 ${undoCount > 0 ? 'text-amber-700' : ''}`} />
                <span>ย้อนกลับ ({undoCount})</span>
              </button>
              {lastUndoMessage && undoCount > 0 && (
                <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-40 bg-slate-900 text-white text-[11px] py-1 px-2.5 rounded shadow-lg whitespace-nowrap">
                  ล่าสุด: {lastUndoMessage}
                </div>
              )}
            </div>

            {/* Sound Chime Toggle */}
            <button
              type="button"
              onClick={onToggleSound}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                soundEnabled
                  ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
              title={soundEnabled ? 'เสียงแจ้งเตือน: เปิดอยู่' : 'เสียงแจ้งเตือน: ปิดอยู่'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Real-time Alert Notification Bell */}
            <button
              type="button"
              onClick={onOpenNotifications}
              className={`relative p-1.5 rounded-lg border text-xs transition-all ${
                alertCount > 0
                  ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100 animate-pulse'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title={`สินค้าถึงเกณฑ์ขั้นต่ำ: ${alertCount} รายการ`}
            >
              <Bell className="w-4 h-4" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>

            {/* Google Sheets Sync Button */}
            <button
              type="button"
              onClick={onOpenSheetsSync}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isSheetsConnected
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Google Sheets</span>
              {isSheetsConnected ? (
                <span className="flex items-center text-[10px] text-emerald-700 font-bold bg-emerald-200/70 px-1 rounded">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 inline" /> เชื่อมแล้ว
                </span>
              ) : (
                <span className="text-[10px] bg-indigo-200 text-indigo-900 px-1 rounded font-bold">
                  เชื่อมต่อ
                </span>
              )}
            </button>

            {/* LINE & Real-time Web App Sync Button */}
            {onOpenLineSync && (
              <button
                type="button"
                onClick={onOpenLineSync}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all bg-[#06C755]/10 border-[#06C755]/40 text-[#05a847] hover:bg-[#06C755]/20 shadow-xs active:scale-95 cursor-pointer"
                title="ซิงค์ข้อมูลเรียลไทม์ระหว่าง Web Browser, Web App และ LINE"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#06C755]" />
                <span className="hidden sm:inline">ซิงค์ LINE</span>
                <span className={`w-2 h-2 rounded-full ${isFirestoreConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              </button>
            )}

            {/* Real-time Online Collaborators Badge */}
            <button
              type="button"
              onClick={onOpenCollaborators}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100 shadow-2xs active:scale-95 cursor-pointer"
              title="ดูรายชื่อผู้ร่วมงานที่กำลังออนไลน์และแก้ไขสต็อกขณะนี้"
            >
              <div className="relative flex items-center">
                <Users className="w-3.5 h-3.5 text-teal-700" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <span className="font-bold">
                ออนไลน์ {collaborators.length > 0 ? `(${collaborators.length})` : ''}
              </span>
            </button>

            {/* User Profile / Google Sign-in */}
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-1.5 pl-1.5 pr-2 py-1 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-xs cursor-pointer shadow-2xs"
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'Profile'}
                      className="w-5 h-5 rounded-full object-cover ring-1 ring-emerald-500"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="max-w-[90px] truncate font-semibold text-slate-800 text-[11px]">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        {currentUser.photoURL ? (
                          <img
                            src={currentUser.photoURL}
                            alt=""
                            className="w-8 h-8 rounded-full border border-slate-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                            {(currentUser.displayName || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {currentUser.displayName || 'ผู้ใช้งาน Google'}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate font-mono">
                            {currentUser.email}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-semibold text-emerald-700">
                          สิทธิ์: แก้ไขสต็อกออนไลน์
                        </span>
                      </div>
                    </div>

                    <div className="p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          if (onOpenCollaborators) onOpenCollaborators();
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center space-x-2 transition-colors cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5 text-teal-600" />
                        <span>ดูทีมที่กำลังออนไลน์ ({collaborators.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          if (onSignOut) onSignOut();
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center space-x-2 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                        <span>ออกจากระบบ</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onGoogleSignIn}
                disabled={isSigningIn}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="ลงชื่อเข้าใช้ด้วยบัญชี Google เพื่อระบุตัวตนและแก้ไขร่วมกัน"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isSigningIn ? '...' : 'ลงชื่อเข้าใช้'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 border-t border-slate-100 pt-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setCurrentTab('count')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              currentTab === 'count'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>นับสต็อกประจำวัน</span>
          </button>

          <button
            onClick={() => setCurrentTab('reorder')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              currentTab === 'reorder'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>สรุปสั่งของเพิ่ม</span>
            {alertCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'reorder'
                    ? 'bg-white text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {alertCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab('reports')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              currentTab === 'reports'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>รายงานสต็อก (วัน/เดือน/ปี)</span>
          </button>

          <button
            onClick={() => setCurrentTab('products')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              currentTab === 'products'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <PackagePlus className="w-4 h-4" />
            <span>จัดการรายการสินค้า</span>
          </button>
        </div>
      </div>
    </header>
  );
};
