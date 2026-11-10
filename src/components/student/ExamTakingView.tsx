/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Exam, Question, ExamSession, SecurityViolation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { mongoService } from '../../services/mongoService';
import { useExamSecurity } from '../../hooks/useExamSecurity';
import {
  ShieldAlert,
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  Maximize2,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { InlineSpinner } from '../ui/Loader';

interface ExamTakingViewProps {
  exam: Exam;
  questions: Question[];
  onFinish: (session: ExamSession) => void;
}

export const ExamTakingView: React.FC<ExamTakingViewProps> = ({
  exam,
  questions,
  onFinish,
}) => {
  const { currentUser } = useAuth();

  // Test state
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(
    exam.durationMinutes * 60
  );
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const timerIntervalRef = useRef<any>(null);
  const answersRef = useRef<Record<string, string>>({});
  const sessionIdRef = useRef<string | null>(null);
  const syncedViolationsCountRef = useRef<number>(0);
  const hasSubmittedRef = useRef<boolean>(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Create live in_progress session immediately when student starts exam
  useEffect(() => {
    let active = true;
    const initLiveSession = async () => {
      try {
        const created = await mongoService.startExamSession({
          examId: exam.id,
          examTitle: exam.title,
          subjectName: exam.subjectName,
          studentId: currentUser?.studentId || currentUser?.id || 'STU-UNKNOWN',
          studentName: currentUser?.fullName || "Noma'lum O'quvchi",
          studentEmail: currentUser?.email || '',
          groupId: currentUser?.groupId || 'grp-1',
          groupName: currentUser?.groupName || 'Guruh',
          status: 'in_progress',
          startedAt: new Date(startTimeRef.current).toISOString(),
          timeSpentSeconds: 0,
          answers: {},
          questionIds: questions.map((q) => q.id),
          variant: questions[0]?.variant,
          score: 0,
          totalScore: questions.reduce((sum, q) => sum + (q.points || 1), 0),
          percentage: 0,
          passed: false,
          violationsCount: 0,
          violations: [],
        });
        if (active) sessionIdRef.current = created.id;
      } catch (err) {
        console.error('Live sessiya boshlanmadi:', err);
      }
    };
    void initLiveSession();
    return () => {
      active = false;
    };
  }, [currentUser, exam, questions]);

  // Handle final submission calculation
  const calculateAndSubmitSession = useCallback(
    async (status: 'completed' | 'terminated', terminationReason?: string, currentViolations?: SecurityViolation[]) => {
      if (hasSubmittedRef.current) return;
      hasSubmittedRef.current = true;
      setIsSubmitting(true);
      clearInterval(timerIntervalRef.current);

      try {
        const timeSpent = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        const currentAnswers = answersRef.current;

        const grade = await mongoService.request<{
          score: number;
          totalScore: number;
          percentage: number;
          grade: number;
          passed: boolean;
        }>('/api/sessions/grade', {
          method: 'POST',
          body: JSON.stringify({
            examId: exam.id,
            answers: currentAnswers,
            questionIds: questions.map((question) => question.id),
            status,
          }),
        });

        const finalViolations = currentViolations || [];

        if (sessionIdRef.current) {
          const saved = await mongoService.submitExamSession(sessionIdRef.current, {
            status,
            answers: currentAnswers,
            questionIds: questions.map((question) => question.id),
            variant: questions[0]?.variant,
            score: grade.score,
            totalScore: grade.totalScore,
            percentage: grade.percentage,
            grade: grade.grade,
            passed: grade.passed,
            timeSpentSeconds: timeSpent,
            violationsCount: finalViolations.length,
            violations: finalViolations,
            terminationReason,
          });
          onFinish(saved);
          return;
        }

        const newSession: ExamSession = {
          id: `sess-${Date.now()}`,
          examId: exam.id,
          examTitle: exam.title,
          subjectName: exam.subjectName,
          studentId: currentUser?.studentId || currentUser?.id || 'STU-UNKNOWN',
          studentName: currentUser?.fullName || "Noma'lum O'quvchi",
          studentEmail: currentUser?.email || '',
          groupId: currentUser?.groupId || 'grp-1',
          groupName: currentUser?.groupName || 'Guruh',
          status,
          startedAt: new Date(startTimeRef.current).toISOString(),
          submittedAt: new Date().toISOString(),
          timeSpentSeconds: timeSpent,
          answers: currentAnswers,
          questionIds: questions.map((question) => question.id),
          variant: questions[0]?.variant,
          score: grade.score,
          totalScore: grade.totalScore,
          percentage: grade.percentage,
          grade: grade.grade,
          passed: grade.passed,
          violationsCount: finalViolations.length,
          violations: finalViolations,
          terminationReason,
        };

        const saved = await mongoService.startExamSession(newSession);
        onFinish(saved);
      } catch (err) {
        console.error('Natijani saqlashda xatolik:', err);
        hasSubmittedRef.current = false;
        setIsSubmitting(false);
      }
    },
    [currentUser, exam, onFinish, questions]
  );

  // Hook for anti-cheat
  const {
    warningCount,
    maxWarnings,
    warningsRemaining,
    violations,
    isTerminated,
    terminationReason,
    isFullscreen,
    activeWarning,
    acknowledgeWarning,
    requestFullscreen,
  } = useExamSecurity({
    enabled: true,
    maxWarnings: 3,
    onTerminated: (reason, recordedViolations) => {
      void calculateAndSubmitSession('terminated', reason, recordedViolations);
    },
  });

  // Sync each anti-cheat violation to MongoDB live session
  useEffect(() => {
    if (!sessionIdRef.current) return;
    if (violations.length > syncedViolationsCountRef.current) {
      const latest = violations.slice(syncedViolationsCountRef.current);
      syncedViolationsCountRef.current = violations.length;
      latest.forEach((v) => {
        if (sessionIdRef.current) {
          void mongoService.recordAntiCheatViolation(sessionIdRef.current, v).catch(() => {});
        }
      });
    }
  }, [violations]);

  // Request fullscreen on initial mount
  useEffect(() => {
    requestFullscreen();
  }, [requestFullscreen]);

  // Countdown timer
  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          calculateAndSubmitSession('completed', 'Vaqt tugadi');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerIntervalRef.current);
  }, [calculateAndSubmitSession]);

  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const currentQuestion = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const isTimeLow = timeLeftSeconds <= 120; // 2 minutes remaining

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-between select-none transition-colors">
      {/* 1. Sticky Mobile-First Top Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs px-3 py-2.5 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Exam title & Question indicator */}
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {exam.title}
            </h1>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                Savol {currentIdx + 1} / {questions.length}
              </span>
              <span>•</span>
              <span>{answeredCount} ta belgilandi</span>
            </div>
          </div>

          {/* Right: Anti-Cheat Badge & Timer */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Warning Badge */}
            <div
              className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border ${
                warningCount === 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : warningCount === 1
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse'
              }`}
              title="Anti-Cheat ogohlantirishlar soni (3 ta bo'lganda test to'xtatiladi)"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{warningCount} / 3</span>
            </div>

            {/* Countdown Timer */}
            <div
              className={`px-2.5 py-1 rounded-lg font-mono text-xs sm:text-sm font-bold flex items-center gap-1.5 border ${
                isTimeLow
                  ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                  : 'bg-slate-900 dark:bg-slate-800 text-white border-slate-800 dark:border-slate-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Fullscreen Recovery Alert if user escaped */}
        {!isFullscreen && (
          <div className="mt-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-900 p-2 rounded-xl text-xs flex items-center justify-between text-amber-900 dark:text-amber-300">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Xavfsizlik talabi: Test to'liq ekran rejimida o'tishi kerak.
            </span>
            <button
              type="button"
              onClick={requestFullscreen}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              To'liq ekranga o'tish
            </button>
          </div>
        )}
      </header>

      {/* 2. Main Question Card Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-start space-y-4">
        {/* Question Jumper Pills (Mobile-optimized horizontal scroll) */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 scrollbar-none">
          {questions.map((q, idx) => {
            const isAnswered = !!answers[q.id];
            const isCurrent = idx === currentIdx;

            return (
              <button
                type="button"
                key={q.id}
                onClick={() => setCurrentIdx(idx)}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center justify-center relative ${
                  isCurrent
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900 shadow-xs'
                    : isAnswered
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {idx + 1}
                {isAnswered && !isCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 absolute bottom-1"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Current Question Body */}
        {currentQuestion && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 shadow-xs space-y-5 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full">
                Savol #{currentIdx + 1}
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                {currentQuestion.points} ball
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
              {currentQuestion.questionText}
            </h2>

            {/* Code / Formula snippet if any */}
            {currentQuestion.codeSnippet && (
              <div className="p-3 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto">
                <pre>{currentQuestion.codeSnippet}</pre>
              </div>
            )}

            {/* Options List */}
            <div className="space-y-2.5 pt-2">
              {currentQuestion.options.map((opt) => {
                const isSelected = answers[currentQuestion.id] === opt.id;

                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => handleSelectOption(currentQuestion.id, opt.id)}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3.5 text-xs sm:text-sm active:scale-[0.99] ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 font-semibold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {isSelected && <span className="w-2 h-2 rounded-full bg-white"></span>}
                    </div>
                    <span className="flex-1">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* 3. Sticky Bottom Mobile Action Bar */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 sticky bottom-0 z-30 shadow-lg transition-colors">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
            disabled={currentIdx === 0}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Oldingisi</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSubmitModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Testni Yakunlash</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
            disabled={currentIdx === questions.length - 1}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all cursor-pointer shadow-xs"
          >
            <span className="hidden sm:inline">Keyingisi</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* 4. Anti-Cheat Warning Modal */}
      {activeWarning && !isTerminated && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border-2 border-rose-500 text-center animate-security-pulse">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-4">
              <ShieldAlert className="w-9 h-9 animate-bounce" />
            </div>

            <span className="text-[11px] font-extrabold uppercase tracking-widest text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-3 py-1 rounded-full border border-rose-200 dark:border-rose-900">
              Qoidabuzarlik AniqlanDI!
            </span>

            <h3 className="text-xl font-black text-slate-900 dark:text-white mt-3">
              Ogohlantirish {warningCount} / {maxWarnings}
            </h3>

            <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-2 bg-rose-50 dark:bg-rose-950/60 p-3 rounded-xl border border-rose-200 dark:border-rose-900">
              {activeWarning.details}
            </p>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
              Test paytida boshqa oynaga, dasturga yoki yorliqqa o'tish qat'iyan taqiqlanadi!
              {warningsRemaining > 0 ? (
                <>
                  {' '}Sizda yana <strong>{warningsRemaining} ta</strong> imkoniyat qoldi. 3-marta qoidabuzarlik sodir etilsa, imtihon avtomatik to'xtatiladi.
                </>
              ) : (
                ' Cheklov chegarasiga yetildi!'
              )}
            </p>

            <button
              type="button"
              onClick={() => {
                acknowledgeWarning();
                requestFullscreen();
              }}
              className="mt-6 w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              Tushundim, Testga Qaytish
            </button>
          </div>
        </div>
      )}

      {/* 5. Submit Confirmation Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-3">
              <HelpCircle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Testni yakunlaysizmi?
            </h3>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 my-4 text-left space-y-1">
              <div>
                Jami savollar: <strong>{questions.length} ta</strong>
              </div>
              <div>
                Belgilangan javoblar: <strong className="text-emerald-600 dark:text-emerald-400">{answeredCount} ta</strong>
              </div>
              {questions.length - answeredCount > 0 && (
                <div className="text-rose-600 dark:text-rose-400 font-semibold">
                  Belgilanmagan savollar: {questions.length - answeredCount} ta
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsSubmitModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Ortga qaytish
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setIsSubmitModalOpen(false);
                  void calculateAndSubmitSession('completed');
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {isSubmitting && <InlineSpinner className="w-3.5 h-3.5" />}
                <span>Ha, Yakunlash</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Fullscreen Submitting Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-7 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-4">
              <InlineSpinner className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Natijalar hisoblanmoqda va saqlanmoqda...
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              Iltimos, sahifani yopmang. Javoblaringiz tekshirilib baholanmoqda.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
