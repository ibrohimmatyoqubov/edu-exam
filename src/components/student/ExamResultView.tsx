/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { ExamSession } from '../../types';
import {
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
  Award,
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ExamResultViewProps {
  session: ExamSession;
  onBackToDashboard: () => void;
}

export const ExamResultView: React.FC<ExamResultViewProps> = ({
  session,
  onBackToDashboard,
}) => {
  useEffect(() => {
    if (session.passed && session.status !== 'terminated') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [session.passed, session.status]);

  const isTerminated = session.status === 'terminated';
  const grade =
    session.grade ??
    (session.percentage >= 90 ? 5 : session.percentage >= 70 ? 4 : session.percentage >= 60 ? 3 : 2);

  return (
    <div className="max-w-xl mx-auto py-6 px-4 space-y-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Status Hero Card */}
      <div
        className={`rounded-3xl p-6 sm:p-8 text-center text-white shadow-xl ${
          isTerminated
            ? 'bg-gradient-to-b from-rose-600 to-rose-900 border border-rose-500'
            : session.passed
            ? 'bg-gradient-to-b from-emerald-600 to-teal-900 border border-emerald-500'
            : 'bg-gradient-to-b from-amber-600 to-slate-900 border border-amber-500'
        }`}
      >
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-white/20 backdrop-blur-xs mb-4">
          {isTerminated ? (
            <ShieldAlert className="w-9 h-9 text-white animate-bounce" />
          ) : session.passed ? (
            <Award className="w-9 h-9 text-white" />
          ) : (
            <XCircle className="w-9 h-9 text-white" />
          )}
        </div>

        <span className="text-xs uppercase font-extrabold tracking-widest px-3 py-1 rounded-full bg-white/20">
          {isTerminated
            ? "Qoidabuzarlik Sababli Chetlatildi"
            : session.passed
            ? "Muvaffaqiyatli Topshirildi"
            : "O'tish Bali To'planmadi"}
        </span>

        <h2 className="text-2xl sm:text-3xl font-black mt-3">
          {session.examTitle}
        </h2>
        <p className="text-white/80 text-xs sm:text-sm mt-1">
          {session.subjectName} • {session.studentName}
        </p>

        {/* Score Circle / Badge */}
        <div className="mt-6 inline-block bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20">
          <div className="text-4xl sm:text-5xl font-black tracking-tight">
            {session.score} <span className="text-xl font-normal text-white/70">/ {session.totalScore} ball</span>
          </div>
          <div className="text-sm font-bold text-white/90 mt-1">
            To'plangan ko'rsatkich: {session.percentage}%
          </div>
          <div className="mt-2 inline-block px-4 py-1 rounded-xl bg-white/20 text-base font-black text-white">
            Baho: {grade}
          </div>
          <div className="text-[10px] text-white/70 mt-2">
            Mezon: 0–59% = 2 • 60–69% = 3 • 70–89% = 4 • 90–100% = 5
          </div>
        </div>
      </div>

      {/* Termination Notice if applicable */}
      {isTerminated && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-2xl p-5 text-xs text-rose-900 dark:text-rose-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-700 dark:text-rose-400">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            Anti-Cheat Cheklovi Ishga Tushdi:
          </div>
          <p className="leading-relaxed">
            {session.terminationReason ||
              "Test paytida 3 marta ruxsatsiz harakat (boshqa oynaga/tabga o'tish yoki to'liq ekrandan chiqish) sodir etildi. Tizim testni to'xtatdi va mavjud javoblarni bazaga yubordi."}
          </p>
        </div>
      )}

      {/* Details Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs grid grid-cols-2 gap-3 text-center transition-colors">
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">Sarflangan Vaqt</div>
          <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            {Math.floor(session.timeSpentSeconds / 60)} daq {session.timeSpentSeconds % 60} son
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">Ogohlantirishlar</div>
          <div className={`text-sm font-bold mt-1 ${
            session.violationsCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {session.violationsCount} / 3 ta
          </div>
        </div>
      </div>

      {/* Violations Log if any */}
      {session.violations && session.violations.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3 transition-colors">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Qayd etilgan xavfsizlik ogohlantirishlari:
          </h4>
          <div className="space-y-2">
            {session.violations.map((v, i) => (
              <div
                key={v.id || i}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    #{i + 1}. {v.details}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {v.type}
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {new Date(v.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Back button */}
      <div className="pt-2">
        <button
          onClick={onBackToDashboard}
          className="w-full py-3.5 rounded-2xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Bosh Sahifaga Qaytish
        </button>
      </div>
    </div>
  );
};
