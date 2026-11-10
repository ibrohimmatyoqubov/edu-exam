/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  ShieldCheck,
  Activity,
  Users,
  FileCheck2,
  HelpCircle,
  Database,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  GraduationCap,
  Sparkles,
  History,
  LayoutDashboard,
} from 'lucide-react';

export type AdminTab = 'live' | 'groups' | 'exams' | 'questions' | 'architecture';
export type StudentTab = 'active_exams' | 'exam_history';

interface SidebarProps {
  adminTab: AdminTab;
  onAdminTabChange: (tab: AdminTab) => void;
  studentTab: StudentTab;
  onStudentTabChange: (tab: StudentTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  adminTab,
  onAdminTabChange,
  studentTab,
  onStudentTabChange,
}) => {
  const { currentUser, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  const isAdmin = role === 'ADMIN';

  const adminNavItems = [
    { id: 'live' as AdminTab, label: 'Jonli Nazorat', icon: Activity, badge: 'Live' },
    { id: 'groups' as AdminTab, label: "Guruhlar & O'quvchilar", icon: Users },
    { id: 'exams' as AdminTab, label: 'Fanlar & Nazoratlar', icon: FileCheck2 },
    { id: 'questions' as AdminTab, label: 'Savollar Banki', icon: HelpCircle },
    { id: 'architecture' as AdminTab, label: 'MongoDB & Arxitektura', icon: Database },
  ];

  const studentNavItems = [
    { id: 'active_exams' as StudentTab, label: 'Mavjud Nazoratlar', icon: LayoutDashboard },
    { id: 'exam_history' as StudentTab, label: 'Natijalar & Savollar Tahlili', icon: History },
  ];

  const handleNavClick = (id: any) => {
    if (isAdmin) {
      onAdminTabChange(id);
    } else {
      onStudentTabChange(id);
    }
    setIsOpenMobile(false);
  };

  return (
    <>
      {/* Mobile Top Bar with Hamburger */}
      <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30 transition-colors">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
            EduExam <span className="text-indigo-600 dark:text-indigo-400">Secure</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
            title="Mavzuni almashtirish"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsOpenMobile(!isOpenMobile)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            {isOpenMobile ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isOpenMobile && (
        <div
          onClick={() => setIsOpenMobile(false)}
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-4 transition-all duration-200 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Logo / Header */}
          <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800/80 mb-5">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 dark:shadow-indigo-950">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
                  EduExam<span className="text-indigo-600 dark:text-indigo-400">Secure</span>
                </span>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {isAdmin ? 'Admin Paneli' : "O'quvchi Kabineti"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpenMobile(false)}
              className="lg:hidden text-slate-400 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Asosiy Menyu
            </p>

            {isAdmin
              ? adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = adminTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-300 dark:shadow-none'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })
              : studentNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = studentTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-300 dark:shadow-none'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
          </div>
        </div>

        {/* Bottom User Profile, Theme Switcher & Logout */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
              <span>{theme === 'dark' ? 'Kunduzgi Rejim' : 'Tungi Rejim'}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase">
              {theme}
            </span>
          </button>

          {/* User Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center text-xs shrink-0 ${
                  isAdmin
                    ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                    : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {currentUser?.fullName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {currentUser?.fullName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {isAdmin ? 'Bosh O\'qituvchi' : currentUser?.groupName || 'O\'quvchi'}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="mt-3 w-full py-1.5 px-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Tizimdan Chiqish</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
