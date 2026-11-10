/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Exam, ExamSession, Question } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { mongoService } from '../../services/mongoService';
import {
  FileCheck2,
  Clock,
  Award,
  Play,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Lock,
  ChevronRight,
  Maximize2,
  Eye,
  Check,
  X,
  HelpCircle,
  Calendar,
} from 'lucide-react';
import { InlineSpinner, PageLoader } from '../ui/Loader';

interface StudentDashboardProps {
  activeTab?: 'active_exams' | 'exam_history';
  onStartExam: (exam: Exam, questions: Question[]) => void;
  onViewResult: (session: ExamSession) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  activeTab = 'active_exams',
  onStartExam,
  onViewResult,
}) => {
  const { currentUser } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedExamForModal, setSelectedExamForModal] = useState<Exam | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isStartingExam, setIsStartingExam] = useState(false);

  // Review session questions modal
  const [reviewSession, setReviewSession] = useState<ExamSession | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<Question[]>([]);
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  const openReview = async (session: ExamSession | null) => {
    setReviewSession(session);
    if (!session) {
      setReviewQuestions([]);
      setIsLoadingReview(false);
      return;
    }
    setReviewQuestions([]);
    setIsLoadingReview(true);
    try {
      setReviewQuestions(await mongoService.getQuestions(session.examId));
    } catch (error) {
      console.error('Javoblar ko‘rib chiqilmadi:', error);
      setReviewQuestions([]);
    } finally {
      setIsLoadingReview(false);
    }
  };

  useEffect(() => {
    const refresh = async (silent = false) => {
      try {
        const [loadedExams, loadedSessions] = await Promise.all([
          mongoService.getExams({ silent }),
          mongoService.getSessions({ silent }),
        ]);
        setExams(loadedExams);
        setSessions(loadedSessions);
      } catch (error) {
        console.error('O‘quvchi nazoratlari yuklanmadi:', error);
      } finally {
        if (!silent) setIsLoading(false);
      }
    };
    void refresh(false);
    const timer = window.setInterval(() => void refresh(true), 4000);
    return () => window.clearInterval(timer);
  }, []);

  // Filter exams strictly assigned to student's group
  const studentGroupId = currentUser?.groupId || '';
  const availableExams = exams.filter((e) => e.groupIds.includes(studentGroupId));

  // Student's completed or submitted sessions
  const studentSessions = sessions.filter(
    (s) => s.studentId === currentUser?.studentId || s.studentEmail === currentUser?.email
  );

  const handleConfirmStart = async () => {
    if (!selectedExamForModal || isStartingExam) return;
    setStartError(null);
    setIsStartingExam(true);
    try {
      const questions = await mongoService.getQuestions(selectedExamForModal.id, true);
      if (questions.length === 0) {
        setStartError("Ushbu nazorat ishi uchun hozircha savollar kiritilmagan. O'qituvchingizga murojaat qiling.");
        return;
      }
      const examToStart = selectedExamForModal;
      setSelectedExamForModal(null);
      onStartExam(examToStart, questions);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Test savollarini yuklashda xatolik yuz berdi.");
    } finally {
      setIsStartingExam(false);
    }
  };

  if (isLoading && exams.length === 0) {
    return <PageLoader text="Nazorat ishlari yuklanmoqda..." />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Student Welcome Header Card */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-emerald-100 text-xs font-semibold mb-3 border border-white/10">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            O'quvchi Shaxsiy Kabineti
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Salom, {currentUser?.fullName}!
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-emerald-100 text-xs sm:text-sm mt-2">
            <span className="bg-black/20 px-2.5 py-1 rounded-lg">
              Guruhingiz: <strong className="text-white">{currentUser?.groupName}</strong>
            </span>
            <span className="bg-black/20 px-2.5 py-1 rounded-lg font-mono">
              Talaba ID: <strong className="text-white">{currentUser?.studentId}</strong>
            </span>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 opacity-10 translate-x-8 translate-y-8 pointer-events-none">
          <ShieldCheck className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* Main View: Tab 1 - Available Active Exams */}
      {activeTab === 'active_exams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Guruhingiz uchun Hozirgi Nazorat Ishlari
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Faqat sizning guruhingizga tegishli va o'qituvchi START qilgan nazoratlar
              </p>
            </div>
            <span className="text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              {availableExams.length} ta nazorat
            </span>
          </div>

          {availableExams.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
              <FileCheck2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Guruhingizga hali nazorat ishlari biriktirilmagan
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableExams.map((exam) => {
                const existingSession = studentSessions.find(
                  (s) => s.examId === exam.id && s.status !== 'in_progress'
                );
                const hasCompleted = !!existingSession;
                const isReadyToStart = exam.isActive && !hasCompleted;

                return (
                  <div
                    key={exam.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 transition-all flex flex-col justify-between shadow-xs ${
                      exam.isActive
                        ? 'border-emerald-300 dark:border-emerald-800/80 ring-2 ring-emerald-50 dark:ring-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-800 opacity-90'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {exam.type.replace('_', ' ')}
                        </span>

                        {hasCompleted ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Topshirildi
                          </span>
                        ) : exam.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                            START (Faol)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                            <Lock className="w-3 h-3 text-slate-400" />
                            To'xtatilgan
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                        {exam.title}
                      </h4>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                        {exam.subjectName}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {exam.durationMinutes} daqiqa
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-medium">
                          <Award className="w-3.5 h-3.5 text-slate-400" />
                          {exam.passingScore}% o'tish bali
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
                      {hasCompleted ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => existingSession && void openReview(existingSession)}
                            className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            Savollar Tahlili
                          </button>
                          <button
                            onClick={() => existingSession && onViewResult(existingSession)}
                            className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                            title="Xulosa ko'rish"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      ) : isReadyToStart ? (
                        <button
                          onClick={() => {
                            setStartError(null);
                            setSelectedExamForModal(exam);
                          }}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-200 dark:shadow-emerald-950 transition-all cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          Testni Boshlash
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold flex items-center justify-center gap-1 cursor-not-allowed"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          O'qituvchi START qilishini kuting
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main View: Tab 2 - Past Exam History & Question-by-Question Review */}
      {activeTab === 'exam_history' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Avval Topshirilgan Nazorat Ishlari va Javoblar Tahlili
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Har bir nazorat ishida qaysi savolga qanday javob berganingizni ko'ring.
            </p>
          </div>

          {studentSessions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
              <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Hozircha topshirilgan nazorat ishlari mavjud emas
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {studentSessions.map((sess) => (
                <div
                  key={sess.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-extrabold text-slate-900 dark:text-white text-base">
                        {sess.examTitle}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          sess.status === 'terminated'
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                            : sess.passed
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {sess.status === 'terminated'
                          ? 'Chetlatilgan'
                          : sess.passed
                          ? "O'tdi"
                          : "O'tmadi"}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3">
                      <span>Fan: {sess.subjectName}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(sess.submittedAt || sess.startedAt).toLocaleString()}
                      </span>
                      {sess.violationsCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            {sess.violationsCount} ta ogohlantirish
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <div className="text-right">
                      <div className="font-black text-slate-900 dark:text-white text-lg">
                        {sess.score} <span className="text-xs text-slate-400 font-normal">/ {sess.totalScore} ball</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {sess.percentage}% • Baho: {sess.grade ?? (sess.percentage >= 90 ? 5 : sess.percentage >= 70 ? 4 : sess.percentage >= 60 ? 3 : 2)}
                      </span>
                    </div>

                    <button
                      onClick={() => void openReview(sess)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Savollarni Ko'rish</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pre-Exam Anti-Cheat Agreement Modal */}
      {selectedExamForModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-white text-center">
              Imtihon Xavfsizlik Qoidalari
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">
              {selectedExamForModal.title}
            </p>

            {/* Rules checklist */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 my-4 space-y-2.5 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-2">
                <Maximize2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>To'liq Ekran (Fullscreen):</strong> Test faqat to'liq ekran rejimida o'tadi.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Oynadan Chiqmaslik:</strong> Boshqa tabga o'tish, Alt+Tab, yoki telefonda boshqa ilovaga o'tish qat'iyan taqiqlanadi.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  <strong>3 Ta Ogohlantirish Cheklovi:</strong> 3-marta qoidabuzarlikda test avtomatik ravishda to'xtatilib, imtihondan chetlatilasiz.
                </span>
              </div>
            </div>

            {startError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                {startError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isStartingExam}
                onClick={() => {
                  setSelectedExamForModal(null);
                  setStartError(null);
                }}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={isStartingExam}
                onClick={() => void handleConfirmStart()}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {isStartingExam && <InlineSpinner className="w-4 h-4" />}
                <span>{isStartingExam ? 'Savollar yuklanmoqda...' : 'Roziman, Boshlash'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deep Question-by-Question Review Modal (O'quvchining har bir savoliga bergan javoblarini ko'rish imkoniyati) */}
      {reviewSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs z-20">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  Savollar va Javoblar Tahlili
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                  {reviewSession.examTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  To'plangan ball: <strong className="text-emerald-600 dark:text-emerald-400">{reviewSession.score} / {reviewSession.totalScore} ({reviewSession.percentage}%)</strong>
                </p>
              </div>

              <button
                onClick={() => void openReview(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Questions Breakdown */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {isLoadingReview ? (
                <PageLoader compact text="Savollar va javoblaringiz yuklanmoqda..." />
              ) : (() => {
                const examQuestions = reviewQuestions.filter((question) => (reviewSession.questionIds || Object.keys(reviewSession.answers)).includes(question.id));

                if (examQuestions.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Savollar ma'lumotlari topilmadi.
                    </div>
                  );
                }

                return examQuestions.map((q, idx) => {
                  const studentSelectedOptId = reviewSession.answers[q.id];
                  const isCorrect = studentSelectedOptId === q.correctOptionId;
                  const isAnswered = !!studentSelectedOptId;

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCorrect
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/80'
                          : isAnswered
                          ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                            {q.questionText}
                          </h4>
                        </div>

                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                            isCorrect
                              ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300'
                              : isAnswered
                              ? 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-300'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {isCorrect ? (
                            <>
                              <Check className="w-3 h-3" />+{q.points} ball
                            </>
                          ) : (
                            <>
                              <X className="w-3 h-3" /> 0 / {q.points} ball
                            </>
                          )}
                        </span>
                      </div>

                      {q.codeSnippet && (
                        <div className="my-2 p-2.5 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto">
                          <pre>{q.codeSnippet}</pre>
                        </div>
                      )}

                      {/* Options */}
                      <div className="space-y-1.5 mt-3">
                        {q.options.map((opt) => {
                          const isStudentPick = studentSelectedOptId === opt.id;
                          const isTrueOption = q.correctOptionId === opt.id;

                          return (
                            <div
                              key={opt.id}
                              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                                isTrueOption
                                  ? 'bg-emerald-100/70 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200 font-bold'
                                  : isStudentPick
                                  ? 'bg-rose-100/70 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-200 font-medium'
                                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span>{opt.text}</span>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                {isStudentPick && (
                                  <span className={`px-1.5 py-0.5 rounded font-bold ${
                                    isCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                                  }`}>
                                    Sizning javobingiz
                                  </span>
                                )}
                                {isTrueOption && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold flex items-center gap-0.5">
                                    <Check className="w-3 h-3" /> To'g'ri javob
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 italic">
                          Tushuntirish: {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex justify-end">
              <button
                onClick={() => void openReview(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
