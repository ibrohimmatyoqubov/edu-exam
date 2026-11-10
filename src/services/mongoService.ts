/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Group, User, Subject, Exam, Question, ExamSession, SecurityViolation } from '../types';

export interface RequestOptions {
  silent?: boolean;
}

let activeRequestsCount = 0;
const loadingSubscribers = new Set<(count: number) => void>();

function notifyLoadingSubscribers() {
  loadingSubscribers.forEach((cb) => cb(activeRequestsCount));
}

export function subscribeLoading(cb: (count: number) => void): () => void {
  loadingSubscribers.add(cb);
  cb(activeRequestsCount);
  return () => {
    loadingSubscribers.delete(cb);
  };
}

/**
 * MongoDB Service
 * Frontend va MongoDB API / Database o'rtasidagi asosiy ma'lumot qatlami.
 * Har bir amaliyot MongoDB BSON schemalari va atomic operatorlari ($inc, $push, $set) asosida bajariladi.
 */
export const mongoService = {
  async request<T>(url: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
    const isSilent = Boolean(options?.silent);
    if (!isSilent) {
      activeRequestsCount += 1;
      notifyLoadingSubscribers();
    }
    try {
      const response = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Server bilan bog‘lanishda xatolik');
      return body as T;
    } finally {
      if (!isSilent) {
        activeRequestsCount = Math.max(0, activeRequestsCount - 1);
        notifyLoadingSubscribers();
      }
    }
  },
  // ==================== GURUHLAR (GROUPS) ====================
  async getGroups(options?: RequestOptions): Promise<Group[]> {
    const data = await this.request<Array<Group & { _id?: string }>>('/api/groups', undefined, options);
    return data.map((g) => ({ ...g, id: g._id || g.id }));
  },

  async createGroup(data: { name: string; description?: string }): Promise<Group> {
    const g = await this.request<Group & { _id?: string }>('/api/groups', { method: 'POST', body: JSON.stringify(data) });
    return { ...g, id: g._id || g.id };
  },

  async updateGroup(groupId: string, data: { name: string; description?: string }): Promise<Group> {
    const g = await this.request<Group & { _id?: string }>(`/api/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return { ...g, id: g._id || g.id };
  },

  async deleteGroup(groupId: string): Promise<void> {
    await this.request(`/api/groups/${groupId}`, { method: 'DELETE' });
  },

  // ==================== O'QUVCHILAR (STUDENTS) ====================
  async getStudentsByGroup(groupId: string, options?: RequestOptions): Promise<User[]> {
    return (await this.getStudents(options)).filter((u) => u.groupId === groupId);
  },

  async getStudents(options?: RequestOptions): Promise<User[]> {
    const data = await this.request<Array<User & { _id?: string }>>('/api/students', undefined, options);
    return data.map((u) => ({ ...u, id: u._id || u.id }));
  },

  async createStudent(student: User): Promise<User> {
    const u = await this.request<User & { _id?: string }>('/api/students', { method: 'POST', body: JSON.stringify(student) });
    return { ...u, id: u._id || u.id };
  },

  async bulkImportStudents(students: User[], groupId: string): Promise<{ count: number }> {
    return this.request('/api/students/bulk', { method: 'POST', body: JSON.stringify({ students, groupId }) });
  },

  async updateStudent(
    userId: string,
    data: { fullName: string; studentId?: string; password?: string; groupId?: string; groupName?: string }
  ): Promise<User> {
    const u = await this.request<User & { _id?: string }>(`/api/students/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return { ...u, id: u._id || u.id };
  },

  async updateStudentPassword(studentId: string, newPass: string): Promise<void> {
    await this.request(`/api/students/${studentId}/password`, { method: 'PUT', body: JSON.stringify({ password: newPass }) });
  },

  async deleteStudent(userId: string): Promise<void> {
    await this.request(`/api/students/${userId}`, { method: 'DELETE' });
  },

  // ==================== FANLAR VA NAZORATLAR (SUBJECTS & EXAMS) ====================
  async getSubjects(options?: RequestOptions): Promise<Subject[]> {
    const data = await this.request<Array<Subject & { _id?: string }>>('/api/subjects', undefined, options);
    return data.map((s) => ({ ...s, id: s._id || s.id }));
  },

  async createSubject(subject: Subject): Promise<Subject> {
    const s = await this.request<Subject & { _id?: string }>('/api/subjects', { method: 'POST', body: JSON.stringify(subject) });
    return { ...s, id: s._id || s.id };
  },

  async updateSubject(
    subjectId: string,
    data: { name: string; code?: string }
  ): Promise<Subject> {
    const s = await this.request<Subject & { _id?: string }>(`/api/subjects/${subjectId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return { ...s, id: s._id || s.id };
  },

  async getExams(options?: RequestOptions): Promise<Exam[]> {
    const data = await this.request<Array<Omit<Exam, 'subjectId'> & { _id?: string; subjectId: string | { _id: string } }>>('/api/exams', undefined, options);
    return data.map((e) => ({ ...e, id: e._id || e.id, subjectId: typeof e.subjectId === 'string' ? e.subjectId : e.subjectId._id }));
  },

  async createExam(exam: Exam): Promise<Exam> {
    const e = await this.request<Omit<Exam, 'subjectId'> & { _id?: string; subjectId: string | { _id: string } }>('/api/exams', { method: 'POST', body: JSON.stringify(exam) });
    return { ...e, id: e._id || e.id, subjectId: typeof e.subjectId === 'string' ? e.subjectId : e.subjectId._id };
  },

  async updateExam(examId: string, data: Partial<Exam>): Promise<Exam> {
    const e = await this.request<Omit<Exam, 'subjectId'> & { _id?: string; subjectId: string | { _id: string } }>(`/api/exams/${examId}`, { method: 'PUT', body: JSON.stringify(data) });
    return { ...e, id: e._id || e.id, subjectId: typeof e.subjectId === 'string' ? e.subjectId : e.subjectId._id };
  },

  /**
   * MongoDB $set operatori yordamida imtihonni START / STOP qilish
   * db.exams.updateOne({ _id: examId }, { $set: { isActive: !current, startedAt: new Date() } })
   */
  async toggleExamStatus(
    examId: string,
    payload?: { groupIds?: string[]; durationMinutes?: number; isActive?: boolean }
  ): Promise<Exam> {
    const e = await this.request<Omit<Exam, 'subjectId'> & { _id?: string; subjectId: string | { _id: string } }>(
      `/api/exams/${examId}/toggle`,
      {
        method: 'POST',
        body: payload ? JSON.stringify(payload) : undefined,
      }
    );
    return { ...e, id: e._id || e.id, subjectId: typeof e.subjectId === 'string' ? e.subjectId : e.subjectId._id };
  },

  // ==================== SAVOLLAR (QUESTIONS) ====================
  async getQuestions(examId: string, studentMode = false, options?: RequestOptions): Promise<Question[]> {
    const data = await this.request<Array<Question & { _id?: string }>>(
      `/api/questions?examId=${encodeURIComponent(examId)}${studentMode ? '&studentMode=true' : ''}`,
      undefined,
      options
    );
    return data.map((q) => ({ ...q, id: q._id || q.id }));
  },

  async createQuestion(question: Question): Promise<Question> {
    const q = await this.request<Question & { _id?: string }>('/api/questions', { method: 'POST', body: JSON.stringify(question) });
    return { ...q, id: q._id || q.id };
  },

  async updateQuestion(questionId: string, data: Partial<Question>): Promise<Question> {
    const q = await this.request<Question & { _id?: string }>(`/api/questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return { ...q, id: q._id || q.id };
  },

  async bulkUploadQuestions(
    examId: string,
    variants: Array<{ questions: Array<{ text: string; options: string[]; correctAnswer: number }> }>
  ): Promise<{ success: boolean; count: number; variants: number }> {
    return this.request('/api/questions/bulk', {
      method: 'POST',
      body: JSON.stringify({ examId, variants }),
    });
  },

  async deleteQuestion(_examId: string, questionId: string): Promise<void> {
    await this.request(`/api/questions/${questionId}`, { method: 'DELETE' });
  },

  async deleteExam(examId: string): Promise<void> { await this.request(`/api/exams/${examId}`, { method: 'DELETE' }); },
  async deleteSubject(subjectId: string): Promise<void> { await this.request(`/api/subjects/${subjectId}`, { method: 'DELETE' }); },

  // ==================== ANTI-CHEAT & SESSYALAR (EXAM SESSIONS) ====================
  async startExamSession(session: Partial<ExamSession>): Promise<ExamSession> {
    const s = await this.request<ExamSession & { _id?: string }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    });
    return {
      ...s,
      id: s._id || s.id,
      examId: String(s.examId),
      answers: s.answers || {},
    };
  },

  async recordAntiCheatViolation(sessionId: string, violation: SecurityViolation): Promise<ExamSession | undefined> {
    const s = await this.request<(ExamSession & { _id?: string }) | null>(
      `/api/sessions/${sessionId}/violation`,
      {
        method: 'PUT',
        body: JSON.stringify({ violation }),
      },
      { silent: true }
    );
    if (!s) return undefined;
    return {
      ...s,
      id: s._id || s.id,
      examId: String(s.examId),
      answers: s.answers || {},
    };
  },

  async submitExamSession(sessionId: string, payload: Partial<ExamSession>): Promise<ExamSession> {
    const s = await this.request<ExamSession & { _id?: string }>(`/api/sessions/${sessionId}/submit`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return {
      ...s,
      id: s._id || s.id,
      examId: String(s.examId),
      answers: s.answers || {},
    };
  },

  async getSessions(examIdOrOptions?: string | RequestOptions, options?: RequestOptions): Promise<ExamSession[]> {
    const examId = typeof examIdOrOptions === 'string' ? examIdOrOptions : undefined;
    const reqOptions = typeof examIdOrOptions === 'object' ? examIdOrOptions : options;
    const url = examId ? `/api/sessions?examId=${encodeURIComponent(examId)}` : '/api/sessions';
    const data = await this.request<Array<ExamSession & { _id?: string; examId: string; answers?: Record<string, string> | Map<string, string> }>>(url, undefined, reqOptions);
    return data.map((s) => ({ ...s, id: s._id || s.id, examId: String(s.examId), answers: s.answers instanceof Map ? Object.fromEntries(s.answers) : s.answers || {} }));
  },

  async getExamStats(examId: string) {
    const stats = await this.request<{
      totalStudents: number;
      avgScore: number;
      passedCount: number;
      avgViolations: number;
    } | null>(`/api/analytics/exam/${examId}`);

    if (!stats) {
      return {
        totalParticipants: 0,
        avgScore: 0,
        passingRate: 0,
        avgViolations: 0,
      };
    }

    return {
      totalParticipants: stats.totalStudents,
      avgScore: Math.round(stats.avgScore || 0),
      passingRate: stats.totalStudents ? Math.round((stats.passedCount / stats.totalStudents) * 100) : 0,
      avgViolations: Number((stats.avgViolations || 0).toFixed(1)),
    };
  },
};
