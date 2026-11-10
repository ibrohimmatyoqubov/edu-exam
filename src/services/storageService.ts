/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  Group,
  Subject,
  Exam,
  Question,
  ExamSession,
} from '../types';
import {
  initialGroups,
  initialUsers,
  initialSubjects,
  initialExams,
  initialQuestions,
  initialExamSessions,
} from '../data/initialData';

const STORAGE_KEYS = {
  USERS: 'eduexam_users',
  GROUPS: 'eduexam_groups',
  SUBJECTS: 'eduexam_subjects',
  EXAMS: 'eduexam_exams',
  QUESTIONS: 'eduexam_questions',
  SESSIONS: 'eduexam_sessions',
  CURRENT_USER: 'eduexam_current_user',
};

const notifyChange = () => {
  window.dispatchEvent(new Event('eduexam-storage-update'));
};

export const storageService = {
  // Users
  getUsers: (): User[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : initialUsers;
    } catch {
      return initialUsers;
    }
  },

  saveUser: (user: User): void => {
    const users = storageService.getUsers();
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    notifyChange();
  },

  deleteUser: (id: string): void => {
    const users = storageService.getUsers().filter((u) => u.id !== id);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    notifyChange();
  },

  // Current logged in user
  getCurrentUser: (): User | null => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser: (user: User | null): void => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
    notifyChange();
  },

  logoutUser: (): void => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    notifyChange();
  },

  // Groups
  getGroups: (): Group[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GROUPS);
      return data ? JSON.parse(data) : initialGroups;
    } catch {
      return initialGroups;
    }
  },

  saveGroup: (group: Group): void => {
    const groups = storageService.getGroups();
    const index = groups.findIndex((g) => g.id === group.id);
    if (index >= 0) {
      groups[index] = group;
    } else {
      groups.push(group);
    }
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    notifyChange();
  },

  deleteGroup: (id: string): void => {
    const groups = storageService.getGroups().filter((g) => g.id !== id);
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    notifyChange();
  },

  // Subjects
  getSubjects: (): Subject[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      return data ? JSON.parse(data) : initialSubjects;
    } catch {
      return initialSubjects;
    }
  },

  saveSubject: (subject: Subject): void => {
    const subjects = storageService.getSubjects();
    const index = subjects.findIndex((s) => s.id === subject.id);
    if (index >= 0) {
      subjects[index] = subject;
    } else {
      subjects.push(subject);
    }
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
    notifyChange();
  },

  deleteSubject: (id: string): void => {
    const subjects = storageService.getSubjects().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
    notifyChange();
  },

  // Exams
  getExams: (): Exam[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EXAMS);
      return data ? JSON.parse(data) : initialExams;
    } catch {
      return initialExams;
    }
  },

  saveExam: (exam: Exam): void => {
    const exams = storageService.getExams();
    const index = exams.findIndex((e) => e.id === exam.id);
    if (index >= 0) {
      exams[index] = exam;
    } else {
      exams.push(exam);
    }
    localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
    notifyChange();
  },

  toggleExamActive: (examId: string, isActive: boolean): void => {
    const exams = storageService.getExams();
    const exam = exams.find((e) => e.id === examId);
    if (exam) {
      exam.isActive = isActive;
      if (isActive) {
        exam.startedAt = new Date().toISOString();
      } else {
        exam.stoppedAt = new Date().toISOString();
      }
      localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
      notifyChange();
    }
  },

  deleteExam: (id: string): void => {
    const exams = storageService.getExams().filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
    notifyChange();
  },

  // Questions
  getQuestions: (examId?: string): Question[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
      const list: Question[] = data ? JSON.parse(data) : initialQuestions;
      if (examId) {
        return list.filter((q) => q.examId === examId);
      }
      return list;
    } catch {
      return initialQuestions;
    }
  },

  saveQuestion: (question: Question): void => {
    const questions = storageService.getQuestions();
    const index = questions.findIndex((q) => q.id === question.id);
    if (index >= 0) {
      questions[index] = question;
    } else {
      questions.push(question);
    }
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));

    // Update questionCount & totalPoints in corresponding exam
    const exams = storageService.getExams();
    const exam = exams.find((e) => e.id === question.examId);
    if (exam) {
      const examQuestions = questions.filter((q) => q.examId === question.examId);
      exam.questionCount = examQuestions.length;
      exam.totalPoints = examQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
      localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
    }

    notifyChange();
  },

  deleteQuestion: (id: string): void => {
    const questions = storageService.getQuestions();
    const question = questions.find((q) => q.id === id);
    const updated = questions.filter((q) => q.id !== id);
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(updated));

    if (question) {
      const exams = storageService.getExams();
      const exam = exams.find((e) => e.id === question.examId);
      if (exam) {
        const examQuestions = updated.filter((q) => q.examId === question.examId);
        exam.questionCount = examQuestions.length;
        exam.totalPoints = examQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
        localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
      }
    }

    notifyChange();
  },

  // Exam Sessions
  getSessions: (examId?: string): ExamSession[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      const list: ExamSession[] = data ? JSON.parse(data) : initialExamSessions;
      if (examId) {
        return list.filter((s) => s.examId === examId);
      }
      return list;
    } catch {
      return initialExamSessions;
    }
  },

  saveSession: (session: ExamSession): void => {
    const sessions = storageService.getSessions();
    const index = sessions.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    notifyChange();
  },

  resetToDefault: (): void => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(initialGroups));
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(initialSubjects));
    localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(initialExams));
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(initialQuestions));
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(initialExamSessions));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(initialUsers[1]));
    notifyChange();
  },
};
