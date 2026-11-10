/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'ADMIN' | 'STUDENT';

export interface User {
  id: string;
  fullName: string;
  email?: string;
  password?: string; // Admin tomonidan tayinlanadigan yoki avtomatik generatsiya qilingan parol
  studentId?: string; // e.g. STU-2024-001
  role: UserRole;
  groupId?: string; // Only for students
  groupName?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string; // e.g. "9-A sinf", "Frontend-101"
  description?: string;
  studentCount: number;
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string; // e.g. "Matematika", "Axborot Texnologiyalari"
  code: string; // e.g. "MATH-101"
  icon?: string;
  createdAt: string;
}

export type ExamType = 'ORALIQ_1' | 'ORALIQ_2' | 'YAKUNIY';

export interface Exam {
  id: string;
  subjectId: string;
  subjectName: string;
  title: string; // e.g. "1-Oraliq Nazorat Ishi"
  type: ExamType;
  durationMinutes: number; // Test davomiyligi
  passingScore: number; // O'tish bali (%)
  maxAttempts: number; // Ruxsat berilgan imkoniyatlar
  groupIds: string[]; // Qaysi guruhlar uchun mo'ljallangan
  isActive: boolean; // START / STOP holati
  startedAt?: string;
  stoppedAt?: string;
  totalPoints: number;
  questionCount: number;
  createdAt: string;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  examId: string;
  variant?: number;
  questionText: string;
  codeSnippet?: string;
  options: QuestionOption[];
  correctOptionId: string;
  points: number; // Savol bali
  explanation?: string;
}

export type SessionStatus = 'in_progress' | 'completed' | 'terminated';

export interface SecurityViolation {
  id: string;
  type: 'tab_switch' | 'window_blur' | 'fullscreen_exit' | 'forbidden_key' | 'context_menu';
  timestamp: string;
  details: string;
}

export interface ExamSession {
  id: string;
  examId: string;
  examTitle: string;
  subjectName: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  groupId: string;
  groupName: string;
  status: SessionStatus;
  startedAt: string;
  submittedAt?: string;
  timeSpentSeconds: number;
  answers: Record<string, string>; // questionId -> selectedOptionId
  questionIds?: string[];
  variant?: number;
  score: number;
  totalScore: number;
  percentage: number;
  grade?: number;
  passed: boolean;
  violationsCount: number;
  violations: SecurityViolation[];
  terminationReason?: string;
}
