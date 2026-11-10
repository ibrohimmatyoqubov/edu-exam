/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { storageService } from '../services/storageService';
import { mongoService } from '../services/mongoService';

interface AuthContextType {
  currentUser: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginStudent: (studentId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  usersList: User[];
  refreshUsers: () => void;
  updateUserPassword: (userId: string, newPassword: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => storageService.getCurrentUser());
  const [usersList, setUsersList] = useState<User[]>([]);

  const refreshUsers = () => {
    void mongoService
      .getStudents({ silent: true })
      .then(setUsersList)
      .catch((error: unknown) => console.error('O‘quvchilar yuklanmadi:', error));
  };

  useEffect(() => {
    refreshUsers();
    const handleStorageUpdate = () => {
      refreshUsers();
      setCurrentUser(storageService.getCurrentUser());
    };

    window.addEventListener('eduexam-storage-update', handleStorageUpdate);
    return () => {
      window.removeEventListener('eduexam-storage-update', handleStorageUpdate);
    };
  }, []);

  const loginAdmin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim();
    try {
      const result = await mongoService.request<{ user: User & { _id?: string } }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ role: 'ADMIN', email: cleanEmail, password }) });
      const admin: User = { ...result.user, id: result.user._id || result.user.id, role: 'ADMIN' };
      storageService.setCurrentUser(admin); setCurrentUser(admin); return { success: true };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Kirishda xatolik' }; }
  };

  const loginStudent = async (studentId: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await mongoService.request<{ user: User & { _id?: string } }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ role: 'STUDENT', studentId, password }) });
      const student = { ...result.user, id: result.user._id || result.user.id };
      storageService.setCurrentUser(student); setCurrentUser(student); return { success: true };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Parol noto‘g‘ri' }; }
  };

  const logout = () => {
    storageService.logoutUser();
    setCurrentUser(null);
  };

  const updateUserPassword = (userId: string, newPassword: string) => {
    void mongoService.updateStudentPassword(userId, newPassword).then(refreshUsers).catch((error: unknown) => console.error('Parol yangilanmadi:', error));
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role || null,
        isAuthenticated: !!currentUser,
        loginAdmin,
        loginStudent,
        logout,
        usersList,
        refreshUsers,
        updateUserPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
