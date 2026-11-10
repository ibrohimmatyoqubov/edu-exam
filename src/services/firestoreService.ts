/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Group, Subject, Exam, Question, ExamSession } from '../types';

/**
 * Real Firestore bilan to'liq sinxronlash xizmati.
 * Har bir to'plam (collection) real-time listener (onSnapshot) orqali ishlaydi.
 */
export const firestoreService = {
  // ================= USERS =================
  async saveUser(user: User): Promise<void> {
    const userRef = doc(db, 'users', user.id);
    await setDoc(userRef, user, { merge: true });
  },

  async getUsers(): Promise<User[]> {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => d.data() as User);
  },

  async deleteUser(userId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId));
  },

  // ================= GROUPS =================
  async saveGroup(group: Group): Promise<void> {
    await setDoc(doc(db, 'groups', group.id), group, { merge: true });
  },

  async getGroups(): Promise<Group[]> {
    const snap = await getDocs(collection(db, 'groups'));
    return snap.docs.map((d) => d.data() as Group);
  },

  async deleteGroup(groupId: string): Promise<void> {
    await deleteDoc(doc(db, 'groups', groupId));
  },

  // ================= SUBJECTS =================
  async saveSubject(subject: Subject): Promise<void> {
    await setDoc(doc(db, 'subjects', subject.id), subject, { merge: true });
  },

  async getSubjects(): Promise<Subject[]> {
    const snap = await getDocs(collection(db, 'subjects'));
    return snap.docs.map((d) => d.data() as Subject);
  },

  async deleteSubject(subjectId: string): Promise<void> {
    await deleteDoc(doc(db, 'subjects', subjectId));
  },

  // ================= EXAMS =================
  async saveExam(exam: Exam): Promise<void> {
    await setDoc(doc(db, 'exams', exam.id), exam, { merge: true });
  },

  async toggleExamStatus(examId: string, isActive: boolean): Promise<void> {
    const examRef = doc(db, 'exams', examId);
    await setDoc(
      examRef,
      {
        isActive,
        ...(isActive ? { startedAt: new Date().toISOString() } : { stoppedAt: new Date().toISOString() }),
      },
      { merge: true }
    );
  },

  async deleteExam(examId: string): Promise<void> {
    await deleteDoc(doc(db, 'exams', examId));
  },

  /**
   * Real-vaqtda barcha nazoratlarni kuzatish (START / STOP o'zgarishlari darhol o'quvchiga yetib boradi)
   */
  subscribeToExams(callback: (exams: Exam[]) => void): Unsubscribe {
    const examsCol = collection(db, 'exams');
    return onSnapshot(examsCol, (snapshot) => {
      const list = snapshot.docs.map((doc) => doc.data() as Exam);
      callback(list);
    });
  },

  // ================= QUESTIONS =================
  async saveQuestion(question: Question): Promise<void> {
    await setDoc(doc(db, 'questions', question.id), question, { merge: true });
  },

  async getQuestions(examId?: string): Promise<Question[]> {
    const colRef = collection(db, 'questions');
    const q = examId ? query(colRef, where('examId', '==', examId)) : colRef;
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Question);
  },

  async deleteQuestion(questionId: string): Promise<void> {
    await deleteDoc(doc(db, 'questions', questionId));
  },

  // ================= EXAM SESSIONS (Anti-Cheat & Natijalar) =================
  async saveSession(session: ExamSession): Promise<void> {
    await setDoc(doc(db, 'exam_sessions', session.id), session, { merge: true });
  },

  /**
   * Admin jonli nazorati uchun real-vaqtda sessiyalarni kuzatish
   */
  subscribeToSessions(callback: (sessions: ExamSession[]) => void): Unsubscribe {
    const sessionsCol = collection(db, 'exam_sessions');
    return onSnapshot(sessionsCol, (snapshot) => {
      const list = snapshot.docs.map((doc) => doc.data() as ExamSession);
      callback(list);
    });
  },
};
