/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ExamSession,
  Exam,
  Question,
} from '../../types';
import { mongoService } from '../../services/mongoService';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  ShieldAlert,
} from 'lucide-react';
import { PageLoader } from '../ui/Loader';

export const LiveMonitor: React.FC = () => {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inspectSession, setInspectSession] = useState<ExamSession | null>(null);
  const [inspectQuestions, setInspectQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingInspect, setIsLoadingInspect] = useState<boolean>(false);

  const openSessionDetails = async (session: ExamSession) => {
    setInspectSession(session);
    setInspectQuestions([]);
    setIsLoadingInspect(true);
    try {
      const questions = await mongoService.getQuestions(session.examId);
      const questionIds = session.questionIds?.length ? session.questionIds : Object.keys(session.answers);
      setInspectQuestions(questions.filter((question) => questionIds.includes(question.id)));
    } catch (error) {
      console.error('Javob tafsilotlari yuklanmadi:', error);
      setInspectQuestions([]);
    } finally {
      setIsLoadingInspect(false);
    }
  };

  useEffect(() => {
    const refresh = async (silent = false) => {
      try {
        const [nextSessions, nextExams] = await Promise.all([
          mongoService.getSessions({ silent }),
          mongoService.getExams({ silent }),
        ]);
        setSessions(nextSessions);
        setExams(nextExams);
      } catch (error) {
        console.error('Jonli monitor ma’lumotlari olinmadi:', error);
      } finally {
        if (!silent) setIsLoading(false);
      }
    };
    void refresh(false);
    const timer = window.setInterval(() => void refresh(true), 3000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredSessions = sessions.filter((s) => {
    if (selectedExamId !== 'all' && s.examId !== selectedExamId) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });

  const inProgressCount = sessions.filter((s) => s.status === 'in_progress').length;
  const terminatedCount = sessions.filter((s) => s.status === 'terminated').length;
  const completedCount = sessions.filter((s) => s.status === 'completed').length;

  if (isLoading && exams.length === 0) {
    return <PageLoader text="Jonli monitoring ma'lumotlari yuklanmoqda..." />;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Live Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Test Topshirayotganlar
            </p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              {inProgressCount}
              {inProgressCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              )}
            </h3>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Hozir tizimda faol</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Anti-Cheat Chetlatish
            </p>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{terminatedCount}</h3>
            <span className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">Qoidabuzarlik sabab to'xtatilgan</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Muvaffaqiyatli Tugatganlar
            </p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{completedCount}</h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Natijasi hisoblangan</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Jami Faol Nazoratlar
            </p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {exams.filter((e) => e.isActive).length} / {exams.length}
            </h3>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">START qilingan</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Eye className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Real-time Session Tracker Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              O'quvchilarning Jonli Imtihon Sessiyalari (Live Sessions)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Har bir o'quvchining Anti-Cheat qoidabuzarliklari soni va statusi real-vaqtda yangilanadi.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              Filtr:
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Barcha holatlar</option>
              <option value="in_progress">Topshirmoqda (In Progress)</option>
              <option value="completed">Tugatgan (Completed)</option>
              <option value="terminated">Chetlatilgan (Terminated)</option>
            </select>

            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[200px]"
            >
              <option value="all">Barcha nazoratlar</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">O'quvchi</th>
                <th className="py-3 px-4">Guruh / ID</th>
                <th className="py-3 px-4">Nazorat Ishi</th>
                <th className="py-3 px-4">Anti-Cheat Ogohlantirish</th>
                <th className="py-3 px-4">Natija (Ball)</th>
                <th className="py-3 px-4">Holat (Status)</th>
                <th className="py-3 px-4 text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 dark:text-slate-500">
                    Hozircha hech qanday faol sessiya topilmadi
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => {
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        {s.studentName}
                        <div className="text-[11px] text-slate-400 font-normal">{s.studentEmail}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{s.groupName}</span>
                        <div className="text-[11px] text-slate-400 font-mono">{s.studentId}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{s.examTitle}</span>
                        <span className="text-[11px] text-slate-400">{s.subjectName}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {s.violationsCount === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              0 ta (Toza)
                            </span>
                          ) : s.violationsCount >= 3 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold text-[11px] border border-rose-300 dark:border-rose-800 animate-pulse">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              {s.violationsCount} / 3 (CHETLATILDI)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold text-[11px] border border-amber-200 dark:border-amber-800">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              {s.violationsCount} / 3 ogohlantirish
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {s.status === 'in_progress' ? (
                          <span className="text-slate-400 dark:text-slate-500 italic">Jarayonda...</span>
                        ) : (
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {s.score} / {s.totalScore}
                            </span>
                            <span
                              className={`ml-1.5 font-bold ${
                                s.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              ({s.percentage}% • {s.grade ?? (s.percentage >= 90 ? 5 : s.percentage >= 70 ? 4 : s.percentage >= 60 ? 3 : 2)} baho)
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {s.status === 'in_progress' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-200 dark:border-blue-800">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                            Yechmoqda
                          </span>
                        )}
                        {s.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Yakunladi
                          </span>
                        )}
                        {s.status === 'terminated' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold text-[11px] border border-rose-200 dark:border-rose-800">
                            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            Chetlatildi
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => void openSessionDetails(s)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 text-slate-700 dark:text-slate-300 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Batafsil
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Session Modal (Detailed Anti-Cheat & Answer Log) */}
      {inspectSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                  Imtihon Sessiyasi Audit Hisoboti
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {inspectSession.studentName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {inspectSession.groupName} • {inspectSession.examTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectSession(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status & Scores */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-400 font-medium">Holat</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 uppercase">
                    {inspectSession.status}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-400 font-medium">To'plangan Ball</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {inspectSession.score} / {inspectSession.totalScore} ({inspectSession.percentage}%)
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-400 font-medium">Sarflangan Vaqt</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {Math.floor(inspectSession.timeSpentSeconds / 60)} daq {inspectSession.timeSpentSeconds % 60} son
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-400 font-medium">Xavfsizlik Xatoliklari</div>
                  <div className={`text-sm font-bold mt-0.5 ${
                    inspectSession.violationsCount >= 3 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                  }`}>
                    {inspectSession.violationsCount} ta
                  </div>
                </div>
              </div>

              {/* Termination Reason if any */}
              {inspectSession.terminationReason && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs">
                  <strong className="font-bold flex items-center gap-1.5 mb-1">
                    <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    Chetlatish Asosi:
                  </strong>
                  {inspectSession.terminationReason}
                </div>
              )}

              {/* Security Violations Log */}
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Anti-Cheat Qaydlar Tarixi (Audit Log)
                </h4>
                {inspectSession.violations.length === 0 ? (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    ✓ Hech qanday qoidabuzarlik qayd etilmadi. O'quvchi imtihonni to'liq halol topshirdi.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {inspectSession.violations.map((v, i) => (
                      <div
                        key={v.id || i}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-start justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            #{i + 1}. {v.details}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Hodisa turi: <span className="font-mono text-indigo-600 dark:text-indigo-400">{v.type}</span>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                          {new Date(v.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Student Answers Summary */}
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-2">
                  Belgilangan Javoblar:
                </h4>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300">
                  {isLoadingInspect ? (
                    <PageLoader compact text="O'quvchi javoblari yuklanmoqda..." />
                  ) : inspectQuestions.length === 0 ? (
                    <span className="text-slate-400">Hech qanday savolga javob belgilanmagan.</span>
                  ) : (
                    <div className="space-y-2">
                      {inspectQuestions.map((question, index) => {
                        const selectedId = inspectSession.answers[question.id];
                        const selected = question.options.find((option) => option.id === selectedId);
                        const correct = question.options.find((option) => option.id === question.correctOptionId);
                        return <div key={question.id} className="bg-white dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-800 space-y-1"><strong>Savol {index + 1}: {question.questionText}</strong><p className={selectedId === question.correctOptionId ? 'text-emerald-600' : 'text-rose-600'}>O‘quvchi javobi: {selected?.text || 'Javob belgilanmagan'}</p><p className="text-emerald-600">To‘g‘ri javob: {correct?.text || '—'}</p></div>;
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectSession(null)}
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
