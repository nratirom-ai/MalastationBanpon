import React, { useState } from 'react';
import { 
  Users, 
  X, 
  CheckCircle2, 
  UserCheck, 
  Edit3, 
  Clock, 
  Smartphone, 
  Monitor, 
  LogIn, 
  LogOut, 
  ShieldCheck, 
  Sparkles, 
  Wifi, 
  Mail, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';
import { UserPresence } from '../types/inventory';
import { User } from 'firebase/auth';

interface OnlineCollaboratorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  collaborators: UserPresence[];
  currentUser: User | null;
  localCollaboratorName: string;
  localCollaboratorEmail?: string | null;
  onUpdateCollaboratorName: (name: string) => void;
  onGoogleSignIn: () => Promise<void>;
  onEmailSignIn: (email: string, name?: string, password?: string) => Promise<void>;
  onSignOut: () => void;
  onRefreshSync?: () => void;
  isSigningIn: boolean;
  selectedDate: string;
  isFirestoreConnected?: boolean;
}

export const OnlineCollaboratorsModal: React.FC<OnlineCollaboratorsModalProps> = ({
  isOpen,
  onClose,
  collaborators,
  currentUser,
  localCollaboratorName,
  localCollaboratorEmail,
  onUpdateCollaboratorName,
  onGoogleSignIn,
  onEmailSignIn,
  onSignOut,
  onRefreshSync,
  isSigningIn,
  selectedDate,
  isFirestoreConnected = true,
}) => {
  const [activeTab, setActiveTab] = useState<'auth' | 'collaborators'>('auth');
  const [emailInput, setEmailInput] = useState(
    localCollaboratorEmail || currentUser?.email || 'N.Ratirom@gmail.com'
  );
  const [nameInput, setNameInput] = useState(
    localCollaboratorName || currentUser?.displayName || 'คุณรติรมย์'
  );
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSyncingNow, setIsSyncingNow] = useState(false);

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!emailInput.trim() || !emailInput.includes('@')) {
      setErrorMessage('กรุณาระบุที่อยู่อีเมลให้ถูกต้อง (เช่น N.Ratirom@gmail.com)');
      return;
    }

    try {
      await onEmailSignIn(emailInput.trim(), nameInput.trim() || undefined, passwordInput || undefined);
      setSuccessMessage(`เข้าสู่ระบบด้วยอีเมล ${emailInput.trim()} เรียบร้อยแล้ว ข้อมูลจะซิงค์แบบเรียลไทม์`);
    } catch (err: any) {
      setErrorMessage(err.message || 'ไม่สามารถเข้าสู่ระบบด้วยอีเมลได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleGoogleClick = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await onGoogleSignIn();
      setSuccessMessage('เข้าสู่ระบบด้วย Google สำเร็จ');
    } catch (err: any) {
      setErrorMessage(err.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ สามารถเข้าสู่ระบบด้วยอีเมลด้านล่างแทนได้ทันที');
    }
  };

  const handleManualSync = () => {
    if (onRefreshSync) {
      setIsSyncingNow(true);
      onRefreshSync();
      setTimeout(() => {
        setIsSyncingNow(false);
        setSuccessMessage('ซิงค์ข้อมูลกับ Cloud Firestore เรียลไทม์ล่าสุดแล้ว');
      }, 700);
    }
  };

  const effectiveEmail = currentUser?.email || localCollaboratorEmail;
  const effectiveName = currentUser?.displayName || localCollaboratorName;

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                ระบบผู้ใช้งานและการซิงค์เรียลไทม์
                <span className="bg-emerald-400/30 text-emerald-100 text-xs px-2 py-0.5 rounded-full font-mono font-semibold">
                  {collaborators.length} คนออนไลน์
                </span>
              </h3>
              <p className="text-xs text-emerald-100">
                ล็อกอินด้วยอีเมลเพื่อบันทึกและซิงค์ข้อมูลสต็อกสินค้าแบบ Real-time ทุกอุปกรณ์
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs inside Modal */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'auth'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>เข้าสู่ระบบ & สิทธิ์การใช้งาน</span>
            {effectiveEmail && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('collaborators')}
            className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'collaborators'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wifi className="w-4 h-4 text-emerald-600" />
            <span>ผู้ใช้ออนไลน์ ({collaborators.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          {activeTab === 'auth' ? (
            <div className="space-y-4">
              {/* Authenticated State */}
              {effectiveEmail ? (
                <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-xs border-2 border-white">
                        {getInitials(effectiveName || effectiveEmail)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          {effectiveName || 'ผู้ใช้งาน'}
                          <span title="ยืนยันสถานะบัญชีเรียบร้อย">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 inline" />
                          </span>
                        </h4>
                        <p className="text-xs text-slate-600 font-mono font-medium">
                          {effectiveEmail}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold mt-0.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>เชื่อมต่อ Real-time สำเร็จ (แก้ไขพร้อมกันได้)</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onSignOut}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>

                  {/* Realtime Sync Control in User Card */}
                  <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>สถานะ: คลังข้อมูล Firestore อัปเดตอัตโนมัติ</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleManualSync}
                      disabled={isSyncingNow}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-md shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 text-emerald-600 ${isSyncingNow ? 'animate-spin' : ''}`} />
                      <span>{isSyncingNow ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูลเดี๋ยวนี้'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Unauthenticated: Email Sign In Form + Google Sign In */
                <div className="space-y-4">
                  {/* Option 1: Direct Email Sign In */}
                  <form onSubmit={handleEmailSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-emerald-600" />
                        เข้าสู่ระบบด้วยอีเมล (Email Login)
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                        แนะนำ
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        อีเมลผู้ใช้งาน (Email)
                      </label>
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="เช่น N.Ratirom@gmail.com"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        ชื่อที่ต้องการแสดง (Display Name)
                      </label>
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="เช่น คุณรติรมย์ หรือ ผู้จัดการร้าน"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        รหัสผ่าน (ถ้ามี หรือเว้นว่างเพื่อเข้าใช้งานทันที)
                      </label>
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="•••••••• (เว้นว่างไว้เพื่อเข้าใช้ด่วน)"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSigningIn}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{isSigningIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วยอีเมลและเริ่มซิงค์เรียลไทม์'}</span>
                    </button>
                  </form>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-3 text-slate-400 text-[11px] font-medium">หรือ</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  {/* Option 2: Google One-Click Sign In */}
                  <div>
                    <button
                      type="button"
                      onClick={handleGoogleClick}
                      disabled={isSigningIn}
                      className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 active:scale-98 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>{isSigningIn ? 'กำลังเชื่อมต่อ...' : 'ลงชื่อเข้าใช้ด้วยบัญชี Google'}</span>
                    </button>
                    <p className="text-[10px] text-slate-400 text-center mt-1">
                      (หากเบราว์เซอร์บล็อกป๊อปอัป ให้ใช้แบบระบุอีเมลด้านบนแทนได้ทันที)
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Collaborators Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>ผู้ใช้ที่เปิดหน้าต่างและนับสต็อกอยู่ในขณะนี้</span>
                <span className="font-mono text-emerald-700 font-semibold">{collaborators.length} คน</span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-white">
                {collaborators.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    ยังไม่มีผู้ใช้อื่นออนไลน์ในขณะนี้
                  </div>
                ) : (
                  collaborators.map((c) => {
                    const isSelf = c.uid === (currentUser?.uid || localCollaboratorEmail);
                    return (
                      <div key={c.uid} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                            {getInitials(c.displayName || c.email || 'U')}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              {c.displayName || 'ผู้ใช้ออนไลน์'}
                              {isSelf && (
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-medium">
                                  คุณ
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {c.email || 'ผู้ร่วมตรวจสต็อก'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right text-[11px]">
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            ออนไลน์
                          </span>
                          <div className="text-slate-400 text-[10px] mt-0.5 flex items-center justify-end gap-1">
                            {c.deviceType === 'mobile' ? (
                              <Smartphone className="w-3 h-3 inline" />
                            ) : (
                              <Monitor className="w-3 h-3 inline" />
                            )}
                            <span>{c.deviceType === 'mobile' ? 'มือถือ' : 'คอมพิวเตอร์'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isFirestoreConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`} />
            <span>{isFirestoreConnected ? 'คลังข้อมูล Firestore เรียลไทม์' : 'กำลังเชื่อมต่อฐานข้อมูล...'}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
