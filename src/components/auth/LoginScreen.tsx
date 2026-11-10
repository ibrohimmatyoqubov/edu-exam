/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { mongoService } from '../../services/mongoService';
import { Group, User } from '../../types';
import {
  ShieldCheck,
  UserCheck,
  GraduationCap,
  Lock,
  Mail,
  Users,
  Sun,
  Moon,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { InlineSpinner, PageLoader } from '../ui/Loader';

export const LoginScreen: React.FC = () => {
  const { loginAdmin, loginStudent } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'admin' | 'student'>('student');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Admin form state (no pre-filled credentials)
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Student form state
  const [groups, setGroups] = useState<Group[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentPassword, setStudentPassword] = useState<string>('');

  useEffect(() => {
    setIsLoadingInitial(true);
    void Promise.all([mongoService.getGroups(), mongoService.getStudents()])
      .then(([loadedGroups, loadedUsers]) => {
        setGroups(loadedGroups);
        setAllUsers(loadedUsers);
        if (loadedGroups[0]) {
          setSelectedGroupId(loadedGroups[0].id);
        }
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Ro‘yxat yuklanmadi'))
      .finally(() => setIsLoadingInitial(false));
  }, []);

  const groupStudents = allUsers.filter(
    (u) => u.role === 'STUDENT' && u.groupId === selectedGroupId
  );

  // Handle group change -> reset student and password (never auto-fill password)
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedStudentId('');
    setStudentPassword('');
    setError(null);
  };

  // Handle student selection -> clear password so student types it manually
  const handleStudentSelect = (studentId: string) => {
    setSelectedStudentId(studentId);
    setStudentPassword('');
    setError(null);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await loginAdmin(adminEmail, adminPassword);
      if (!res.success) {
        setError(res.error || 'Kirishda xatolik yuz berdi');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedStudentId) {
      setError("Iltimos, avval o'z ismingizni tanlang!");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await loginStudent(selectedStudentId, studentPassword);
      if (!res.success) {
        setError(res.error || "Parol noto'g'ri");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4 transition-colors">
      {/* Dark / Light toggle in top right */}
      <div className="absolute top-5 right-5">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={theme === 'dark' ? 'Kunduzgi rejimga o\'tish' : 'Tungi rejimga o\'tish'}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-indigo-600" />
          )}
        </button>
      </div>

      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xl transition-all">
        {/* Brand / Logo */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white mx-auto flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-indigo-950 mb-3">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            EduExam <span className="text-indigo-600 dark:text-indigo-400">Secure</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Oraliq va Yakuniy nazorat ishlari tizimiga kirish
          </p>
        </div>

        {/* Role Switcher Tabs (Admin / O'quvchi) */}
        <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl flex items-center mb-6 border border-slate-200/60 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              setActiveTab('student');
              setShowPassword(false);
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'student'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>O'quvchi Kirishi</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setShowPassword(false);
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Admin Kirishi</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: Student Login (Select Group -> Select Student Name -> Enter Password) */}
        {activeTab === 'student' && (
          isLoadingInitial ? (
            <PageLoader compact text="Guruh va o'quvchilar yuklanmoqda..." subtext="Baza bilan bog'lanilmoqda" />
          ) : (
          <form onSubmit={handleStudentSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-500" />
                1. Guruhingizni tanlang *
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => handleGroupChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {groups.length === 0 ? (
                  <option value="">Guruhlar topilmadi</option>
                ) : (
                  groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                2. Ism va familiyangizni tanlang *
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => handleStudentSelect(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {groupStudents.length === 0 ? (
                  <option value="">Ushbu guruhda o'quvchilar yo'q</option>
                ) : (
                  <>
                    <option value="">-- Ism va familiyangizni tanlang --</option>
                    {groupStudents.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName} ({st.studentId || 'ID yo\'q'})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                3. Parolingizni kiriting *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="Parolni qo'lda kiriting"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                O'qituvchi tomonidan tushuntirilgan kirish parolini kiriting.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedStudentId || !studentPassword.trim()}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 dark:shadow-emerald-950 transition-all cursor-pointer mt-2 flex items-center justify-center gap-2"
            >
              {isSubmitting && <InlineSpinner />}
              <span>{isSubmitting ? 'Tekshirilmoqda...' : 'Test Tizimiga Kirish'}</span>
            </button>
          </form>
          )
        )}

        {/* Tab 2: Admin Login (Email + Password, manual input) */}
        {activeTab === 'admin' && (
          <form onSubmit={handleAdminSubmit} autoComplete="off" className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-500" />
                Admin Email yoki Ism *
              </label>
              <input
                type="text"
                required
                autoComplete="off"
                placeholder="Email yoki ismingizni kiriting"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-500" />
                Admin Paroli *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="Parolni kiriting"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !adminEmail.trim() || !adminPassword.trim()}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-200 dark:shadow-indigo-950 transition-all cursor-pointer mt-2 flex items-center justify-center gap-2"
            >
              {isSubmitting && <InlineSpinner />}
              <span>{isSubmitting ? 'Tekshirilmoqda...' : 'Boshqaruv Paneliga Kirish'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
