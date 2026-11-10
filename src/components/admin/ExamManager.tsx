/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Exam, Subject, Group, ExamType, ExamSession, Question, User } from '../../types';
import { mongoService } from '../../services/mongoService';
import {
  BookOpen,
  FileCheck2,
  Plus,
  Trash2,
  Play,
  Square,
  Clock,
  Award,
  ArrowLeft,
  Activity,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  AlertCircle,
  Users,
  SlidersHorizontal,
  Check,
  X,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Archive,
  Download,
  Edit2,
} from 'lucide-react';
import {
  exportExamReportToExcel,
  exportSingleStudentReportToExcel,
  type QuestionAnswerAudit,
  type StudentExamReportRow,
} from '../../utils/examReportExport';
import { InlineSpinner, PageLoader } from '../ui/Loader';

function computeGrade(percentage: number): number {
  if (percentage >= 90) return 5;
  if (percentage >= 70) return 4;
  if (percentage >= 60) return 3;
  return 2;
}

export const ExamManager: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);

  // Navigation hierarchy:
  // 1) !selectedSubjectId => Fanlar ro'yxati (GroupManager card style)
  // 2) selectedSubjectId && !monitorExamId && !finishedReportExamId => Fan ichidagi nazorat ishlari sahifasi (2 tab: Davom etayotgan / Yakunlangan)
  // 3) monitorExamId => Nazorat ishining Live monitor sahifasi
  // 4) finishedReportExamId => Yakunlangan nazorat ishi guruh kesimidagi hisoboti & Excel export
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [activeSubjectTab, setActiveSubjectTab] = useState<'ongoing' | 'finished'>('ongoing');
  const [monitorExamId, setMonitorExamId] = useState<string | null>(null);
  const [monitorGroupFilter, setMonitorGroupFilter] = useState<string>('all');
  const [finishedReportExamId, setFinishedReportExamId] = useState<string | null>(null);
  const [selectedReportGroupId, setSelectedReportGroupId] = useState<string>('all');
  const [reportQuestions, setReportQuestions] = useState<Question[]>([]);
  const [isLoadingReportQuestions, setIsLoadingReportQuestions] = useState<boolean>(false);
  const [expandedReportKeys, setExpandedReportKeys] = useState<Record<string, boolean>>({});
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [exportingStudentKey, setExportingStudentKey] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Subject Modal state (Create / Edit)
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectError, setSubjectError] = useState<string | null>(null);

  // Exam Modal state (Create / Edit)
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [examTitle, setExamTitle] = useState('');
  const [examSubjectId, setExamSubjectId] = useState('');
  const [examType, setExamType] = useState<ExamType>('ORALIQ_1');
  const [durationMinutes, setDurationMinutes] = useState<number>(20);
  const [passingScore, setPassingScore] = useState<number>(60);
  const [maxAttempts, setMaxAttempts] = useState<number>(1);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Start / Configure Exam Modal state (pick groups + duration before START)
  const [startConfigExam, setStartConfigExam] = useState<Exam | null>(null);
  const [startGroupIds, setStartGroupIds] = useState<string[]>([]);
  const [startDuration, setStartDuration] = useState<number>(20);
  const [startOnlyUpdate, setStartOnlyUpdate] = useState<boolean>(false);
  const [startConfigError, setStartConfigError] = useState<string | null>(null);

  // Single-step delete confirmation modals
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [isSavingStartConfig, setIsSavingStartConfig] = useState(false);
  const [togglingExamId, setTogglingExamId] = useState<string | null>(null);

  // Detailed student answers inspection modal
  const [inspectSession, setInspectSession] = useState<ExamSession | null>(null);
  const [inspectQuestions, setInspectQuestions] = useState<Question[]>([]);
  const [isLoadingInspectQuestions, setIsLoadingInspectQuestions] = useState(false);

  const refreshFromMongo = useCallback(async (silent = false) => {
    try {
      const [nextExams, nextSubjects, nextGroups, nextStudents, nextSessions] = await Promise.all([
        mongoService.getExams({ silent }),
        mongoService.getSubjects({ silent }),
        mongoService.getGroups({ silent }),
        mongoService.getStudents({ silent }),
        mongoService.getSessions({ silent }),
      ]);
      setExams(nextExams);
      setSubjects(nextSubjects);
      setGroups(nextGroups);
      setStudents(nextStudents);
      setSessions(nextSessions);
    } catch (error) {
      console.error('Fanlar va nazoratlarni yuklashda xatolik:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshFromMongo(false);
  }, [refreshFromMongo]);

  // Live polling when inside exam monitor or viewing active exams (silent so global bar does not flash)
  useEffect(() => {
    const intervalMs = monitorExamId ? 3000 : 8000;
    const timer = window.setInterval(() => {
      void refreshFromMongo(true);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [monitorExamId, refreshFromMongo]);

  const openCreateSubjectModal = () => {
    setSubjectError(null);
    setEditingSubject(null);
    setSubjectName('');
    setSubjectCode('');
    setIsSubjectModalOpen(true);
  };

  const openEditSubjectModal = (sub: Subject) => {
    setSubjectError(null);
    setEditingSubject(sub);
    setSubjectName(sub.name);
    setSubjectCode(sub.code || '');
    setIsSubjectModalOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim() || isCreatingSubject) return;
    setSubjectError(null);

    setIsCreatingSubject(true);
    try {
      if (editingSubject) {
        await mongoService.updateSubject(editingSubject.id, {
          name: subjectName.trim(),
          code: subjectCode.trim() || editingSubject.code,
        });
        await refreshFromMongo(true);
        setEditingSubject(null);
        setSubjectName('');
        setSubjectCode('');
        setIsSubjectModalOpen(false);
      } else {
        const newSubject: Subject = {
          id: `sbj-${Date.now()}`,
          name: subjectName.trim(),
          code: subjectCode.trim() || `SBJ-${Math.floor(100 + Math.random() * 900)}`,
          createdAt: new Date().toISOString(),
        };
        const created = await mongoService.createSubject(newSubject);
        await refreshFromMongo(true);
        setSubjectName('');
        setSubjectCode('');
        setIsSubjectModalOpen(false);
        setSelectedSubjectId(created.id);
      }
    } catch (error) {
      console.error('Fan saqlashda xatolik:', error);
      setSubjectError(error instanceof Error ? error.message : 'Fanni saqlashda xatolik yuz berdi.');
    } finally {
      setIsCreatingSubject(false);
    }
  };

  const handleConfirmDeleteSubject = async () => {
    if (!deletingSubject) return;
    setIsDeleting(true);
    try {
      const id = deletingSubject.id;
      await mongoService.deleteSubject(id);
      await refreshFromMongo(true);
      if (selectedSubjectId === id) setSelectedSubjectId(null);
      setDeletingSubject(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const openCreateExamModal = (defaultSubId?: string | null) => {
    setFormError(null);
    setEditingExam(null);
    setExamTitle('');
    setExamSubjectId(defaultSubId || selectedSubjectId || subjects[0]?.id || '');
    setExamType('ORALIQ_1');
    setDurationMinutes(20);
    setPassingScore(60);
    setMaxAttempts(1);
    setSelectedGroupIds([]);
    setIsExamModalOpen(true);
  };

  const openEditExamModal = (exam: Exam) => {
    setFormError(null);
    setEditingExam(exam);
    setExamTitle(exam.title);
    setExamSubjectId(exam.subjectId);
    setExamType(exam.type);
    setDurationMinutes(exam.durationMinutes);
    setPassingScore(exam.passingScore);
    setMaxAttempts(exam.maxAttempts);
    setSelectedGroupIds(exam.groupIds || []);
    setIsExamModalOpen(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const targetSubjectId = editingExam ? examSubjectId || editingExam.subjectId : selectedSubjectId || examSubjectId;

    if (!examTitle.trim() || !targetSubjectId || selectedGroupIds.length === 0) {
      setFormError("Iltimos, nazorat nomi, fan va kamida bitta guruhni tanlang!");
      return;
    }

    const sub = subjects.find((s) => s.id === targetSubjectId);

    setIsCreatingExam(true);
    try {
      if (editingExam) {
        await mongoService.updateExam(editingExam.id, {
          title: examTitle.trim(),
          subjectId: targetSubjectId,
          subjectName: sub?.name || editingExam.subjectName,
          type: examType,
          durationMinutes: Number(durationMinutes) || 20,
          passingScore: Number(passingScore) || 60,
          maxAttempts: Number(maxAttempts) || 1,
          groupIds: selectedGroupIds,
        });
        await refreshFromMongo(true);
        setEditingExam(null);
        setExamTitle('');
        setSelectedGroupIds([]);
        setIsExamModalOpen(false);
      } else {
        const newExam: Exam = {
          id: `ex-${Date.now()}`,
          subjectId: targetSubjectId,
          subjectName: sub?.name || 'Fan',
          title: examTitle.trim(),
          type: examType,
          durationMinutes: Number(durationMinutes) || 20,
          passingScore: Number(passingScore) || 60,
          maxAttempts: Number(maxAttempts) || 1,
          groupIds: selectedGroupIds,
          isActive: false,
          totalPoints: 0,
          questionCount: 0,
          createdAt: new Date().toISOString(),
        };
        await mongoService.createExam(newExam);
        await refreshFromMongo(true);
        setExamTitle('');
        setSelectedGroupIds([]);
        setIsExamModalOpen(false);
      }
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : editingExam
          ? 'Nazorat ma’lumotlarini yangilashda xatolik'
          : 'Nazorat yaratishda xatolik'
      );
    } finally {
      setIsCreatingExam(false);
    }
  };

  const openStartConfigModal = (exam: Exam, onlyUpdate = false) => {
    setStartConfigError(null);
    setStartConfigExam(exam);
    setStartGroupIds(exam.groupIds || []);
    setStartDuration(exam.durationMinutes || 20);
    setStartOnlyUpdate(onlyUpdate);
  };

  const handleConfirmStartOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startConfigExam || startGroupIds.length === 0 || isSavingStartConfig) return;
    setStartConfigError(null);

    setIsSavingStartConfig(true);
    try {
      if (startOnlyUpdate) {
        await mongoService.updateExam(startConfigExam.id, {
          groupIds: startGroupIds,
          durationMinutes: Number(startDuration) || 20,
        });
      } else {
        await mongoService.toggleExamStatus(startConfigExam.id, {
          groupIds: startGroupIds,
          durationMinutes: Number(startDuration) || 20,
          isActive: true,
        });
      }

      await refreshFromMongo(true);
      if (!startOnlyUpdate) {
        setActiveSubjectTab('ongoing');
      }
      setStartConfigExam(null);
    } catch (error) {
      setStartConfigError(
        error instanceof Error ? error.message : 'Nazorat sozlamalarini saqlashda xatolik yuz berdi.'
      );
    } finally {
      setIsSavingStartConfig(false);
    }
  };

  const handleStopExam = async (examId: string) => {
    if (togglingExamId) return;
    setTogglingExamId(examId);
    try {
      await mongoService.toggleExamStatus(examId, { isActive: false });
      await refreshFromMongo(true);
      setActiveSubjectTab('finished');
    } finally {
      setTogglingExamId(null);
    }
  };

  const handleConfirmDeleteExam = async () => {
    if (!deletingExam) return;
    setIsDeleting(true);
    try {
      const id = deletingExam.id;
      await mongoService.deleteExam(id);
      await refreshFromMongo(true);
      if (monitorExamId === id) setMonitorExamId(null);
      if (finishedReportExamId === id) setFinishedReportExamId(null);
      setDeletingExam(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const toggleStartGroupSelection = (groupId: string) => {
    setStartGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const openFinishedReport = useCallback(
    async (exam: Exam) => {
      setFinishedReportExamId(exam.id);
      setMonitorExamId(null);
      setExpandedReportKeys({});
      setExportError(null);

      const examSess = sessions.filter((s) => s.examId === exam.id);
      const firstGroupWithSess = examSess.find((s) => s.groupId)?.groupId;
      const defaultGroup = firstGroupWithSess || exam.groupIds[0] || 'all';
      setSelectedReportGroupId(defaultGroup);

      setIsLoadingReportQuestions(true);
      try {
        const qs = await mongoService.getQuestions(exam.id);
        setReportQuestions(qs);
      } catch (err) {
        console.error('Hisobot savollari yuklanmadi:', err);
        setReportQuestions([]);
      } finally {
        setIsLoadingReportQuestions(false);
      }
    },
    [sessions]
  );

  const openSessionDetails = async (session: ExamSession) => {
    setInspectSession(session);
    setInspectQuestions([]);
    setIsLoadingInspectQuestions(true);
    try {
      const allQs = await mongoService.getQuestions(session.examId);
      const qIds = session.questionIds?.length ? session.questionIds : Object.keys(session.answers || {});
      const matched = qIds.length > 0 ? allQs.filter((q) => qIds.includes(q.id)) : allQs;
      setInspectQuestions(matched);
    } catch (error) {
      console.error('Savol javoblari yuklanmadi:', error);
      setInspectQuestions([]);
    } finally {
      setIsLoadingInspectQuestions(false);
    }
  };

  const currentSubject = subjects.find((s) => s.id === selectedSubjectId);
  const subjectExams = exams.filter((e) => e.subjectId === selectedSubjectId);
  const monitorExam = exams.find((e) => e.id === monitorExamId);
  const finishedReportExam = exams.find((e) => e.id === finishedReportExamId);

  const isExamFinishedCategory = (exam: Exam) => {
    if (exam.isActive) return false;
    const examSessions = sessions.filter((s) => s.examId === exam.id);
    const hasLive = examSessions.some((s) => s.status === 'in_progress');
    if (hasLive) return false;
    return Boolean(exam.stoppedAt) || examSessions.length > 0;
  };

  const ongoingSubjectExams = subjectExams.filter((e) => !isExamFinishedCategory(e));
  const finishedSubjectExams = subjectExams.filter((e) => isExamFinishedCategory(e));

  if (isLoading && subjects.length === 0) {
    return <PageLoader text="Fanlar va nazorat ishlari yuklanmoqda..." />;
  }

  return (
    <div className="space-y-6">
      {/* ========================================================
          VIEW 1: FAQAT FANLAR RO'YXATI (Guruhlar dizaynida)
         ======================================================== */}
      {!selectedSubjectId && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Fanlar Ro'yxati
                </h2>
                <span className="text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  {subjects.length} ta fan
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Fan ustiga bosing va shu fanga tegishli nazorat ishlarini yaratish, guruhlarga START berish hamda Live kuzatish sahifasiga kiring.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateSubjectModal}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Yangi Fan Qo'shish
            </button>
          </div>

          {subjects.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Hozircha fanlar qo'shilmagan
              </h3>
              <button
                type="button"
                onClick={openCreateSubjectModal}
                className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Birinchi fanni qo'shish
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map((sub) => {
                const count = exams.filter((e) => e.subjectId === sub.id).length;
                const activeCount = exams.filter((e) => e.subjectId === sub.id && e.isActive).length;

                return (
                  <div
                    key={sub.id}
                    onClick={() => {
                      setSelectedSubjectId(sub.id);
                      setMonitorExamId(null);
                      setFinishedReportExamId(null);
                      setActiveSubjectTab('ongoing');
                    }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <span className="font-mono text-xs font-black px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                          {sub.code}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditSubjectModal(sub);
                            }}
                            className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                            title="Fanni tahrirlash"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingSubject(sub);
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                            title="Fanni o'chirish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-bold text-base text-slate-900 dark:text-white mt-2">
                        {sub.name}
                      </h4>

                      {activeCount > 0 && (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          {activeCount} ta faol nazorat
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                        <FileCheck2 className="w-4 h-4 text-indigo-500" />
                        {count} ta nazorat ishi
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Nazoratlar sahifasi →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          VIEW 2: FAN ICHIDAGI NAZORAT ISHLARI SAHIFASI (2 XIL BO'LIM)
         ======================================================== */}
      {selectedSubjectId && !monitorExamId && !finishedReportExamId && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top Bar */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedSubjectId(null)}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Fanlarga qaytish</span>
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    {currentSubject?.code}
                  </span>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {currentSubject?.name}
                  </h2>
                  {currentSubject && (
                    <button
                      type="button"
                      onClick={() => openEditSubjectModal(currentSubject)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer transition-colors"
                      title="Fan ma'lumotlarini tahrirlash"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Davom etayotgan va yakunlangan nazorat ishlari ({subjectExams.length} ta)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openCreateExamModal(selectedSubjectId)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Yangi Nazorat Yaratish
            </button>
          </div>

          {/* 2 Xil Nazoratlar Tab Switcher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setActiveSubjectTab('ongoing')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                activeSubjectTab === 'ongoing'
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700 shadow-xs ring-2 ring-emerald-500/15'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    activeSubjectTab === 'ongoing'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Hozirgi Davom Etayotgan Nazoratlar
                    {ongoingSubjectExams.some((e) => e.isActive) && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Faol START berilgan yoki boshlashga tayyor nazorat ishlari
                  </div>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-black ${
                  activeSubjectTab === 'ongoing'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {ongoingSubjectExams.length} ta
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubjectTab('finished')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                activeSubjectTab === 'finished'
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-700 shadow-xs ring-2 ring-indigo-500/15'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    activeSubjectTab === 'finished'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-white">
                    Yakunlangan Nazorat Ishlari
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Guruh natijalari, savol-javob tahlili, baholar va Excel hisobot
                  </div>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-black ${
                  activeSubjectTab === 'finished'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {finishedSubjectExams.length} ta
              </span>
            </button>
          </div>

          {/* TAB 1: HOZIRGI DAVOM ETAYOTGAN NAZORATLAR */}
          {activeSubjectTab === 'ongoing' && (
            <>
              {ongoingSubjectExams.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
                  <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Hozirgi davom etayotgan nazorat ishi yo'q
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Yangi nazorat ishi yarating yoki yakunlangan nazoratlar bo'limidan natijalarni ko'ring.
                  </p>
                  <button
                    type="button"
                    onClick={() => openCreateExamModal(selectedSubjectId)}
                    className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Nazorat ishi yaratish
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {ongoingSubjectExams.map((exam) => {
                    const assignedGroups = groups.filter((g) => exam.groupIds.includes(g.id));
                    const examSessionsCount = sessions.filter((s) => s.examId === exam.id).length;
                    const liveCount = sessions.filter(
                      (s) => s.examId === exam.id && s.status === 'in_progress'
                    ).length;

                    return (
                      <div
                        key={exam.id}
                        className={`bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden transition-all flex flex-col justify-between ${
                          exam.isActive
                            ? 'border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-100 dark:ring-emerald-950/40 shadow-md'
                            : 'border-slate-200 dark:border-slate-800 shadow-xs'
                        }`}
                      >
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <span
                              className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                exam.type === 'YAKUNIY'
                                  ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                  : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              }`}
                            >
                              {exam.type.replace('_', ' ')}
                            </span>

                            {exam.isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                DAVOM ETMOQDA (FAOL)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                                Boshlashga tayyor
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                            {exam.title}
                          </h3>

                          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                              <div className="text-[10px] text-slate-400 font-medium">Davomiyligi</div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center justify-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {exam.durationMinutes} daq
                              </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                              <div className="text-[10px] text-slate-400 font-medium">O'tish Bali</div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center justify-center gap-1">
                                <Award className="w-3 h-3 text-slate-400" />
                                {exam.passingScore}%
                              </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                              <div className="text-[10px] text-slate-400 font-medium">Topshirgan</div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                                {examSessionsCount} ta {liveCount > 0 ? `(${liveCount} live)` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1">
                              {assignedGroups.length === 0 ? (
                                <span className="text-[11px] text-amber-600">Guruh biriktirilmagan</span>
                              ) : (
                                assignedGroups.map((g) => (
                                  <span
                                    key={g.id}
                                    className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-bold font-mono"
                                  >
                                    {g.name}
                                  </span>
                                ))
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => openStartConfigModal(exam, true)}
                              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                              title="Guruh va vaqtni sozlash"
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                              Sozlash
                            </button>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMonitorExamId(exam.id);
                              setMonitorGroupFilter('all');
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Activity className="w-4 h-4" />
                            <span>Live Kuzatuv & Jarayon</span>
                          </button>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditExamModal(exam)}
                                className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                                title="Nazorat ma'lumotlarini tahrirlash"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingExam(exam)}
                                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                title="Nazoratni o'chirish"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {exam.isActive ? (
                              <button
                                type="button"
                                disabled={togglingExamId === exam.id}
                                onClick={() => void handleStopExam(exam.id)}
                                className="flex-1 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60"
                              >
                                {togglingExamId === exam.id ? (
                                  <>
                                    <InlineSpinner className="w-4 h-4" />
                                    To'xtatilmoqda...
                                  </>
                                ) : (
                                  <>
                                    <Square className="w-4 h-4 fill-current" />
                                    Yakunlash (STOP)
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openStartConfigModal(exam, false)}
                                className="flex-1 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <Play className="w-4 h-4 fill-current" />
                                Guruhga START Berish
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* TAB 2: YAKUNLANGAN NAZORAT ISHLARI */}
          {activeSubjectTab === 'finished' && (
            <>
              {finishedSubjectExams.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
                  <Archive className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Hozircha yakunlangan nazorat ishlari yo'q
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    Davom etayotgan nazorat ishini <strong>Yakunlash (STOP)</strong> qilganingizdan so'ng, u avtomatik ravishda ushbu bo'limga o'tadi va guruh kesimidagi barcha natijalarni ko'rish hamda Excel yuklab olish mumkin bo'ladi.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {finishedSubjectExams.map((exam) => {
                    const examSess = sessions.filter(
                      (s) => s.examId === exam.id && s.status !== 'in_progress'
                    );
                    const passedCnt = examSess.filter((s) => s.passed).length;
                    const avgPct = examSess.length
                      ? Math.round(examSess.reduce((sum, s) => sum + s.percentage, 0) / examSess.length)
                      : 0;
                    const participatedGroupIds = Array.from(
                      new Set([...exam.groupIds, ...examSess.map((s) => s.groupId).filter(Boolean)])
                    );
                    const assignedGroups = groups.filter((g) => participatedGroupIds.includes(g.id));

                    return (
                      <div
                        key={exam.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between overflow-hidden"
                      >
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <span
                              className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                exam.type === 'YAKUNIY'
                                  ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                  : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              }`}
                            >
                              {exam.type.replace('_', ' ')}
                            </span>

                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Yakunlangan
                            </span>
                          </div>

                          <h3 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                            {exam.title}
                          </h3>

                          {exam.stoppedAt && (
                            <p className="text-[11px] text-slate-400 mt-1">
                              Yakunlangan vaqt: {new Date(exam.stoppedAt).toLocaleString('uz-UZ')}
                            </p>
                          )}

                          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                              <div className="text-[10px] text-slate-400 font-medium">Topshirgan</div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                                {examSess.length} ta
                              </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                              <div className="text-[10px] text-slate-400 font-medium">O'tganlar</div>
                              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                {passedCnt} / {examSess.length}
                              </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                              <div className="text-[10px] text-slate-400 font-medium">O'rtacha</div>
                              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                                {avgPct}%
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-1">
                            {assignedGroups.map((g) => (
                              <span
                                key={g.id}
                                className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-bold font-mono"
                              >
                                {g.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          <button
                            type="button"
                            onClick={() => void openFinishedReport(exam)}
                            className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Guruh Natijalari & Excel Hisobot</span>
                          </button>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditExamModal(exam)}
                                className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                                title="Nazorat ma'lumotlarini tahrirlash"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingExam(exam)}
                                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                title="Nazoratni o'chirish"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => openStartConfigModal(exam, false)}
                              className="flex-1 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Boshqa Guruhga Qayta START
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================
          VIEW 3: NAZORAT ISHINING LIVE REJIM & NATIJALARI SAHIFASI
         ======================================================== */}
      {selectedSubjectId && monitorExamId && monitorExam && (() => {
        const assignedGroups = groups.filter((g) => monitorExam.groupIds.includes(g.id));
        const activeGroupIds =
          monitorGroupFilter === 'all' ? monitorExam.groupIds : [monitorGroupFilter];

        const examSessions = sessions.filter(
          (s) => s.examId === monitorExam.id && (monitorGroupFilter === 'all' || s.groupId === monitorGroupFilter)
        );
        const targetStudents = students.filter(
          (st) => st.role === 'STUDENT' && st.groupId && activeGroupIds.includes(st.groupId)
        );

        const sessionByStudentKey = new Map<string, ExamSession>();
        examSessions.forEach((sess) => {
          sessionByStudentKey.set(sess.studentId, sess);
        });

        // Build unified rows: every student in the assigned group + any extra sessions
        const matchedSessionIds = new Set<string>();
        const studentRows = targetStudents.map((st) => {
          const sess =
            sessionByStudentKey.get(st.studentId || '') || sessionByStudentKey.get(st.id);
          if (sess) matchedSessionIds.add(sess.id);
          return { student: st, session: sess };
        });

        // Include any session whose student wasn't in targetStudents (e.g. if group changed later)
        examSessions.forEach((sess) => {
          if (!matchedSessionIds.has(sess.id)) {
            studentRows.push({
              student: {
                id: sess.studentId,
                fullName: sess.studentName,
                studentId: sess.studentId,
                role: 'STUDENT',
                groupId: sess.groupId,
                groupName: sess.groupName,
                createdAt: sess.startedAt,
              },
              session: sess,
            });
          }
        });

        const liveCount = examSessions.filter((s) => s.status === 'in_progress').length;
        const passedCount = examSessions.filter((s) => s.status !== 'in_progress' && s.passed).length;
        const failedCount = examSessions.filter((s) => s.status !== 'in_progress' && !s.passed).length;
        const notStartedCount = studentRows.filter((r) => !r.session).length;

        return (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Top Bar */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMonitorExamId(null)}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Nazoratlarga qaytish</span>
                </button>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      {monitorExam.title}
                    </h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live rejim (3s)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {monitorExam.subjectName} • Davomiyligi: <strong>{monitorExam.durationMinutes} daqiqa</strong> • O'tish bali: <strong>{monitorExam.passingScore}%</strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openStartConfigModal(monitorExam, true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Guruh & Vaqt
                </button>

                {monitorExam.isActive ? (
                  <button
                    type="button"
                    disabled={togglingExamId === monitorExam.id}
                    onClick={() => void handleStopExam(monitorExam.id)}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {togglingExamId === monitorExam.id ? (
                      <>
                        <InlineSpinner className="w-3.5 h-3.5" />
                        To'xtatilmoqda...
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        STOP Qilish
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void openFinishedReport(monitorExam)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Hisobot & Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => openStartConfigModal(monitorExam, false)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      START Berish
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Group Selector Tabs */}
            <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mr-1">
                <Users className="w-4 h-4 text-indigo-500" />
                Guruh bo'yicha ko'rish:
              </span>
              <button
                type="button"
                onClick={() => setMonitorGroupFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  monitorGroupFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Barcha biriktirilgan guruhlar ({assignedGroups.length})
              </button>
              {assignedGroups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setMonitorGroupFilter(g.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono cursor-pointer transition-colors ${
                    monitorGroupFilter === g.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Hozir Yechmoqda (Live)</div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-2">
                  {liveCount}
                  {liveCount > 0 && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Muvaffaqiyatli O'tdi</div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {passedCount}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Yiqildi / Chetlatildi</div>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                  {failedCount}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Hali Boshlamagan</div>
                <div className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
                  {notStartedCount}
                </div>
              </div>
            </div>

            {/* Students Results & Live Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Guruh O'quvchilarining Jonli Holati va Yakuniy Baholari
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Kim qanday baho oldi (2, 3, 4, 5), kim o'tdi/yiqildi va har birining belgilagan savol javoblarini ko'ring.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">O'quvchi</th>
                      <th className="py-3 px-4">Guruh</th>
                      <th className="py-3 px-4">Holat (Live)</th>
                      <th className="py-3 px-4">Anti-Cheat</th>
                      <th className="py-3 px-4">Ball / Foiz</th>
                      <th className="py-3 px-4">Baho</th>
                      <th className="py-3 px-4">Natija</th>
                      <th className="py-3 px-4 text-right">Javoblar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {studentRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-slate-400">
                          Tanlangan guruhlarda o'quvchilar topilmadi.
                        </td>
                      </tr>
                    ) : (
                      studentRows.map(({ student, session }) => {
                        const grade =
                          session && session.status !== 'in_progress'
                            ? session.grade ?? computeGrade(session.percentage)
                            : null;

                        return (
                          <tr
                            key={session?.id || student.id}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                              {student.fullName}
                              <div className="text-[11px] text-slate-400 font-mono font-normal">
                                {student.studentId || student.id}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                              {student.groupName || session?.groupName || '—'}
                            </td>
                            <td className="py-3.5 px-4">
                              {!session ? (
                                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold text-[11px]">
                                  Boshlamagan
                                </span>
                              ) : session.status === 'in_progress' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-200 dark:border-blue-800">
                                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                                  Yechmoqda (Live)
                                </span>
                              ) : session.status === 'terminated' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold text-[11px] border border-rose-200 dark:border-rose-800">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Chetlatildi
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Yakunladi
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {!session ? (
                                <span className="text-slate-400">—</span>
                              ) : session.violationsCount === 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  0 / 3 Toza
                                </span>
                              ) : (
                                <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {session.violationsCount} / 3
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {!session || session.status === 'in_progress' ? (
                                <span className="text-slate-400 italic">Jarayonda...</span>
                              ) : (
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {session.score} / {session.totalScore} ({session.percentage}%)
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {grade === null ? (
                                <span className="text-slate-400">—</span>
                              ) : (
                                <span
                                  className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-xs ${
                                    grade === 5
                                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                      : grade === 4
                                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                      : grade === 3
                                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                  }`}
                                >
                                  {grade}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {!session || session.status === 'in_progress' ? (
                                <span className="text-slate-400">—</span>
                              ) : session.passed ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                                  O'tdi
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[11px]">
                                  Yiqildi
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {session ? (
                                <button
                                  type="button"
                                  onClick={() => void openSessionDetails(session)}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 text-slate-700 dark:text-slate-300 font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Javoblarni ko'rish
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Kutilmoqda</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================
          VIEW 4: YAKUNLANGAN NAZORAT ISHI GURUH HISOBOTI VA EXCEL EXPORT
         ======================================================== */}
      {selectedSubjectId && finishedReportExamId && finishedReportExam && (() => {
        const allExamSessions = sessions.filter((s) => s.examId === finishedReportExam.id);
        const participatingGroupIds = Array.from(
          new Set([
            ...finishedReportExam.groupIds,
            ...allExamSessions.map((s) => s.groupId).filter(Boolean),
          ])
        );
        const availableGroups = groups.filter((g) => participatingGroupIds.includes(g.id));

        const targetGroupIds =
          selectedReportGroupId === 'all' ? participatingGroupIds : [selectedReportGroupId];

        const filteredSessions = allExamSessions.filter(
          (s) => selectedReportGroupId === 'all' || s.groupId === selectedReportGroupId
        );

        const targetStudents = students.filter(
          (st) => st.role === 'STUDENT' && st.groupId && targetGroupIds.includes(st.groupId)
        );

        const sessionByStudentKey = new Map<string, ExamSession>();
        filteredSessions.forEach((sess) => {
          sessionByStudentKey.set(sess.studentId, sess);
        });

        const matchedSessIds = new Set<string>();
        const pairedEntries: Array<{ student: User; session?: ExamSession }> = targetStudents.map((st) => {
          const sess =
            sessionByStudentKey.get(st.studentId || '') || sessionByStudentKey.get(st.id);
          if (sess) matchedSessIds.add(sess.id);
          return { student: st, session: sess };
        });

        filteredSessions.forEach((sess) => {
          if (!matchedSessIds.has(sess.id)) {
            pairedEntries.push({
              student: {
                id: sess.studentId,
                fullName: sess.studentName,
                studentId: sess.studentId,
                role: 'STUDENT',
                groupId: sess.groupId,
                groupName: sess.groupName,
                createdAt: sess.startedAt,
              },
              session: sess,
            });
          }
        });

        const hasVariants = reportQuestions.some((q) => typeof q.variant === 'number');
        const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

        const reportRows: StudentExamReportRow[] = pairedEntries.map(({ student, session }) => {
          let studentQs: Question[] = [];
          if (session?.questionIds && session.questionIds.length > 0) {
            const qMap = new Map(reportQuestions.map((q) => [q.id, q]));
            studentQs = session.questionIds
              .map((qid) => qMap.get(qid))
              .filter((q): q is Question => Boolean(q));
          }

          if (studentQs.length === 0 && session?.variant) {
            studentQs = reportQuestions.filter((q) => q.variant === session.variant);
          }

          if (studentQs.length === 0 && session && Object.keys(session.answers || {}).length > 0) {
            const answeredIds = Object.keys(session.answers);
            if (hasVariants) {
              const firstAnsweredQ = reportQuestions.find((q) => answeredIds.includes(q.id));
              if (firstAnsweredQ?.variant) {
                studentQs = reportQuestions.filter((q) => q.variant === firstAnsweredQ.variant);
              }
            }
            if (studentQs.length === 0) {
              studentQs = reportQuestions;
            }
          }

          if (studentQs.length === 0 && !hasVariants) {
            studentQs = reportQuestions;
          }

          const questionDetails: QuestionAnswerAudit[] = studentQs.map((q, idx) => {
            const selectedOptId = session?.answers?.[q.id];
            const selectedIdx = q.options.findIndex((o) => o.id === selectedOptId);
            const correctIdx = q.options.findIndex((o) => o.id === q.correctOptionId);
            const selectedOpt = selectedIdx >= 0 ? q.options[selectedIdx] : undefined;
            const correctOpt = correctIdx >= 0 ? q.options[correctIdx] : undefined;
            const isCorrect =
              !selectedOptId ? null : selectedOptId === q.correctOptionId;

            return {
              index: idx + 1,
              questionId: q.id,
              questionText: q.questionText,
              selectedLetter: selectedIdx >= 0 ? OPTION_LETTERS[selectedIdx] || String(selectedIdx + 1) : '',
              selectedText: selectedOpt?.text || 'Belgilanmagan',
              correctLetter: correctIdx >= 0 ? OPTION_LETTERS[correctIdx] || String(correctIdx + 1) : '?',
              correctText: correctOpt?.text || "Noma'lum",
              isCorrect,
            };
          });

          const totalQuestions = questionDetails.length;
          const correctCount =
            session && totalQuestions > 0
              ? questionDetails.filter((d) => d.isCorrect === true).length
              : 0;
          const isFinished = Boolean(session && session.status !== 'in_progress');
          const percentage = isFinished && session ? session.percentage : 0;
          const grade = isFinished && session ? session.grade ?? computeGrade(session.percentage) : null;
          const passed = Boolean(isFinished && session?.passed);

          return {
            student,
            session,
            variant: session?.variant ?? studentQs[0]?.variant,
            correctCount,
            totalQuestions,
            percentage,
            grade,
            passed,
            questionDetails,
          };
        });

        const finishedOnly = reportRows.filter((r) => r.session && r.session.status !== 'in_progress');
        const passedCount = finishedOnly.filter((r) => r.passed).length;
        const failedCount = finishedOnly.filter((r) => !r.passed).length;
        const avgPct = finishedOnly.length
          ? Math.round(finishedOnly.reduce((acc, r) => acc + r.percentage, 0) / finishedOnly.length)
          : 0;
        const avgCorrect = finishedOnly.length
          ? (finishedOnly.reduce((acc, r) => acc + r.correctCount, 0) / finishedOnly.length).toFixed(1)
          : '0';
        const sampleTotalQ = finishedOnly.find((r) => r.totalQuestions > 0)?.totalQuestions || 0;

        const gradeDistribution = [5, 4, 3, 2].map((g) => ({
          grade: g,
          count: finishedOnly.filter((r) => r.grade === g).length,
        }));

        const selectedGroupName =
          selectedReportGroupId === 'all'
            ? 'Barcha guruhlar'
            : groups.find((g) => g.id === selectedReportGroupId)?.name || 'Tanlangan guruh';

        const allExpanded =
          reportRows.length > 0 &&
          reportRows.every((r) => expandedReportKeys[r.session?.id || r.student.id]);

        const toggleAllExpanded = () => {
          const nextVal = !allExpanded;
          const nextMap: Record<string, boolean> = {};
          reportRows.forEach((r) => {
            if (r.session) nextMap[r.session.id || r.student.id] = nextVal;
          });
          setExpandedReportKeys(nextMap);
        };

        const handleExportExcel = async () => {
          setIsExportingExcel(true);
          setExportError(null);
          try {
            await exportExamReportToExcel({
              exam: finishedReportExam,
              subjectName: currentSubject?.name || finishedReportExam.subjectName,
              groupLabel: selectedGroupName,
              rows: reportRows,
            });
          } catch (err) {
            setExportError(
              err instanceof Error ? err.message : "Excel hisobotni yuklab olishda xatolik yuz berdi"
            );
          } finally {
            setIsExportingExcel(false);
          }
        };

        const handleExportSingleStudent = async (row: StudentExamReportRow, rowKey: string) => {
          setExportingStudentKey(rowKey);
          setExportError(null);
          try {
            await exportSingleStudentReportToExcel({
              exam: finishedReportExam,
              subjectName: currentSubject?.name || finishedReportExam.subjectName,
              row,
            });
          } catch (err) {
            setExportError(
              err instanceof Error ? err.message : "O'quvchi Excel faylini yuklab olishda xatolik yuz berdi"
            );
          } finally {
            setExportingStudentKey(null);
          }
        };

        return (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Top Bar */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFinishedReportExamId(null)}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Yakunlangan nazoratlarga qaytish</span>
                </button>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      {finishedReportExam.title}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold border border-indigo-200 dark:border-indigo-800">
                      Yakunlangan Hisobot
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {currentSubject?.name} • Davomiyligi: <strong>{finishedReportExam.durationMinutes} daq</strong> • O'tish bali: <strong>{finishedReportExam.passingScore}%</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isExportingExcel || isLoadingReportQuestions || reportRows.length === 0}
                onClick={() => void handleExportExcel()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors shrink-0"
              >
                {isExportingExcel ? <InlineSpinner className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                <span>
                  {isExportingExcel ? 'Tayyorlanmoqda...' : 'Umumiy Excel (.xlsx) Yuklab Olish'}
                </span>
              </button>
            </div>

            {exportError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{exportError}</span>
              </div>
            )}

            {/* Guruh tanlash */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-500" />
                Nazorat ishi qaysi guruhda olinganini tanlang:
              </div>
              <div className="flex flex-wrap gap-2">
                {availableGroups.map((g) => {
                  const gSessionsCount = allExamSessions.filter(
                    (s) => s.groupId === g.id && s.status !== 'in_progress'
                  ).length;
                  const gStudentsCount = students.filter(
                    (st) => st.role === 'STUDENT' && st.groupId === g.id
                  ).length;
                  const isSelected = selectedReportGroupId === g.id;

                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedReportGroupId(g.id);
                        setExpandedReportKeys({});
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2 border ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      <span className="font-mono">{g.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {gSessionsCount}/{gStudentsCount || gSessionsCount}
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedReportGroupId('all');
                    setExpandedReportKeys({});
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                    selectedReportGroupId === 'all'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  Barcha guruhlar ({availableGroups.length})
                </button>
              </div>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Topshirganlar</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {finishedOnly.length} / {reportRows.length}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase">O'rtacha To'g'ri / Foiz</div>
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                  {sampleTotalQ > 0 ? `${avgCorrect}/${sampleTotalQ} • ` : ''}{avgPct}%
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase">O'tdi / Yiqildi</div>
                <div className="text-2xl font-black mt-1 flex items-center gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">{passedCount}</span>
                  <span className="text-slate-300 dark:text-slate-700">/</span>
                  <span className="text-rose-600 dark:text-rose-400">{failedCount}</span>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase mb-1.5">Baholar Taqsimoti</div>
                <div className="flex flex-wrap gap-1.5">
                  {gradeDistribution.map((gd) => (
                    <span
                      key={gd.grade}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                        gd.grade === 5
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : gd.grade === 4
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : gd.grade === 3
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {gd.grade}: {gd.count}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Students Results & Inline Question Answers */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {selectedGroupName} — O'quvchilar Natijalari va Savol-Javoblari
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Har bir o'quvchining nechtadan nechtasiga to'g'ri javob bergani, bahosi va qaysi savolga qanday javob bergani.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleAllExpanded}
                  disabled={finishedOnly.length === 0}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 self-start sm:self-auto"
                >
                  {allExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span>
                    {allExpanded ? 'Barcha javoblarni yopish' : 'Barcha savol-javoblarni ochish'}
                  </span>
                </button>
              </div>

              {isLoadingReportQuestions ? (
                <PageLoader compact text="Savol va javoblar yuklanmoqda..." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-4 w-10">№</th>
                        <th className="py-3 px-4">O'quvchi</th>
                        <th className="py-3 px-4">Variant</th>
                        <th className="py-3 px-4">To'g'ri javoblar</th>
                        <th className="py-3 px-4">Foiz</th>
                        <th className="py-3 px-4">Baho</th>
                        <th className="py-3 px-4">Natija</th>
                        <th className="py-3 px-4">Savollar kesimi</th>
                        <th className="py-3 px-4 text-right">Batafsil</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reportRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-10 text-slate-400">
                            Tanlangan guruhda o'quvchilar topilmadi.
                          </td>
                        </tr>
                      ) : (
                        reportRows.map((row, rowIdx) => {
                          const rowKey = row.session?.id || row.student.id;
                          const isExpanded = Boolean(expandedReportKeys[rowKey]);
                          const isFinished = Boolean(row.session && row.session.status !== 'in_progress');

                          return (
                            <React.Fragment key={rowKey}>
                              <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="py-3.5 px-4 font-mono text-slate-400 font-bold">
                                  {rowIdx + 1}
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {row.student.fullName}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    {row.student.studentId || row.student.id} • {row.student.groupName || row.session?.groupName || '—'}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-mono font-bold text-slate-600 dark:text-slate-300">
                                  {row.variant ? `${row.variant}-variant` : '—'}
                                </td>
                                <td className="py-3.5 px-4">
                                  {isFinished && row.totalQuestions > 0 ? (
                                    <span className="font-black text-slate-900 dark:text-white">
                                      {row.correctCount} / {row.totalQuestions} ta
                                    </span>
                                  ) : isFinished && row.session ? (
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      {row.session.score} / {row.session.totalScore} ball
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                                  {isFinished ? `${row.percentage}%` : '—'}
                                </td>
                                <td className="py-3.5 px-4">
                                  {row.grade === null ? (
                                    <span className="text-slate-400">—</span>
                                  ) : (
                                    <span
                                      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-xs ${
                                        row.grade === 5
                                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                          : row.grade === 4
                                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                          : row.grade === 3
                                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                          : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                      }`}
                                    >
                                      {row.grade}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4">
                                  {!row.session ? (
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold text-[11px]">
                                      Topshirmagan
                                    </span>
                                  ) : row.session.status === 'terminated' ? (
                                    <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[11px]">
                                      Chetlatildi
                                    </span>
                                  ) : row.passed ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                                      O'tdi
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[11px]">
                                      Yiqildi
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4">
                                  {row.session && row.questionDetails.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                      {row.questionDetails.map((qd) => (
                                        <span
                                          key={qd.questionId}
                                          title={`${qd.index}-savol: Tanlangan (${qd.selectedLetter || 'yo‘q'}) • To‘g‘ri (${qd.correctLetter})`}
                                          className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                            qd.isCorrect === true
                                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                              : qd.isCorrect === false
                                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                          }`}
                                        >
                                          {qd.index}
                                          {qd.isCorrect === true ? '✓' : qd.isCorrect === false ? '✗' : '•'}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  {row.session ? (
                                    <div className="inline-flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        disabled={exportingStudentKey === rowKey}
                                        onClick={() => void handleExportSingleStudent(row, rowKey)}
                                        title="Ushbu o'quvchining shaxsiy natijasini Excel (.xlsx) qilib yuklab olish"
                                        className="px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                                      >
                                        {exportingStudentKey === rowKey ? (
                                          <InlineSpinner className="w-3.5 h-3.5" />
                                        ) : (
                                          <FileSpreadsheet className="w-3.5 h-3.5" />
                                        )}
                                        <span>{exportingStudentKey === rowKey ? 'Yuklanmoqda...' : 'Excel'}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedReportKeys((prev) => ({
                                            ...prev,
                                            [rowKey]: !prev[rowKey],
                                          }))
                                        }
                                        className={`px-2.5 py-1.5 rounded-lg border font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                          isExpanded
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 text-slate-700 dark:text-slate-300'
                                        }`}
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                        <span>{isExpanded ? 'Yopish' : 'Javoblar'}</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">Yo'q</span>
                                  )}
                                </td>
                              </tr>

                              {/* Expanded Question-by-Question Audit Panel */}
                              {isExpanded && row.session && (
                                <tr className="bg-slate-50/90 dark:bg-slate-950/60">
                                  <td colSpan={9} className="p-4 sm:p-5">
                                    <div className="space-y-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                          {row.student.fullName} — Har bir savol bo'yicha javoblar ({row.correctCount}/{row.totalQuestions} to'g'ri, {row.grade} baho)
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          {row.session.terminationReason && (
                                            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                              <ShieldAlert className="w-3.5 h-3.5" />
                                              {row.session.terminationReason}
                                            </span>
                                          )}
                                          <button
                                            type="button"
                                            disabled={exportingStudentKey === rowKey}
                                            onClick={() => void handleExportSingleStudent(row, rowKey)}
                                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                          >
                                            {exportingStudentKey === rowKey ? (
                                              <InlineSpinner className="w-3.5 h-3.5" />
                                            ) : (
                                              <Download className="w-3.5 h-3.5" />
                                            )}
                                            <span>
                                              {exportingStudentKey === rowKey ? 'Tayyorlanmoqda...' : 'Shaxsiy Excel (.xlsx)'}
                                            </span>
                                          </button>
                                        </div>
                                      </div>

                                      {row.questionDetails.length === 0 ? (
                                        <p className="text-xs text-slate-400">
                                          Savollar tafsiloti topilmadi.
                                        </p>
                                      ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                          {row.questionDetails.map((qd) => (
                                            <div
                                              key={qd.questionId}
                                              className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                                                qd.isCorrect === true
                                                  ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/70'
                                                  : qd.isCorrect === false
                                                  ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/70'
                                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                                              }`}
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="font-bold text-slate-900 dark:text-white leading-snug">
                                                  {qd.index}. {qd.questionText}
                                                </div>
                                                <span
                                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                                    qd.isCorrect === true
                                                      ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                                                      : qd.isCorrect === false
                                                      ? 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300'
                                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                                  }`}
                                                >
                                                  {qd.isCorrect === true
                                                    ? "To'g'ri"
                                                    : qd.isCorrect === false
                                                    ? "Noto'g'ri"
                                                    : 'Belgilanmagan'}
                                                </span>
                                              </div>

                                              <div className="text-[11px] space-y-0.5">
                                                <div
                                                  className={
                                                    qd.isCorrect === true
                                                      ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
                                                      : qd.isCorrect === false
                                                      ? 'text-rose-700 dark:text-rose-300 font-semibold'
                                                      : 'text-slate-500 italic'
                                                  }
                                                >
                                                  O'quvchi javobi:{' '}
                                                  <span className="font-bold">
                                                    {qd.selectedLetter
                                                      ? `${qd.selectedLetter}) ${qd.selectedText}`
                                                      : 'Belgilanmagan'}
                                                  </span>
                                                </div>
                                                {qd.isCorrect !== true && (
                                                  <div className="text-emerald-700 dark:text-emerald-400">
                                                    To'g'ri javob:{' '}
                                                    <span className="font-bold">
                                                      {qd.correctLetter}) {qd.correctText}
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ========================================================
          MODAL: CREATE SUBJECT
         ======================================================== */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              {editingSubject ? 'Fan Ma’lumotlarini Tahrirlash' : "Yangi Fan Qo'shish"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Masalan: Matematika, Fizika, Veb Dasturlash
            </p>

            {subjectError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{subjectError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fan Nomi *
                </label>
                <input
                  type="text"
                  required
                  disabled={isCreatingSubject}
                  placeholder="masalan: Oliy Matematika"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fan Kodi (ixtiyoriy)
                </label>
                <input
                  type="text"
                  disabled={isCreatingSubject}
                  placeholder="masalan: MATH-101"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono disabled:opacity-60"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isCreatingSubject}
                  onClick={() => {
                    setIsSubjectModalOpen(false);
                    setEditingSubject(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSubject}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isCreatingSubject && <InlineSpinner className="w-3.5 h-3.5" />}
                  <span>
                    {isCreatingSubject
                      ? 'Saqlanmoqda...'
                      : editingSubject
                      ? "O'zgarishlarni Saqlash"
                      : 'Fanni Saqlash'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CREATE / EDIT EXAM
         ======================================================== */}
      {isExamModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              {editingExam ? 'Nazorat Ishi Ma’lumotlarini Tahrirlash' : 'Yangi Nazorat Ishi Yaratish'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Oraliq yoki Yakuniy nazorat parametrlarini belgilang
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveExam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nazorat Ishi Nomi *
                </label>
                <input
                  type="text"
                  required
                  disabled={isCreatingExam}
                  placeholder="masalan: 1-Oraliq Nazorat: Algebra va Funksiyalar"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fan
                  </label>
                  <select
                    value={editingExam ? examSubjectId : selectedSubjectId || examSubjectId}
                    onChange={(e) => setExamSubjectId(e.target.value)}
                    disabled={isCreatingExam || (!editingExam && !!selectedSubjectId)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-75"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nazorat Turi *
                  </label>
                  <select
                    disabled={isCreatingExam}
                    value={examType}
                    onChange={(e) => setExamType(e.target.value as ExamType)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-60"
                  >
                    <option value="ORALIQ_1">1-Oraliq Nazorat</option>
                    <option value="ORALIQ_2">2-Oraliq Nazorat</option>
                    <option value="YAKUNIY">Yakuniy Nazorat</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vaqti (daqiqa)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    disabled={isCreatingExam}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    O'tish Bali (%)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={100}
                    disabled={isCreatingExam}
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Imkoniyatlar
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    disabled={isCreatingExam}
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Qaysi guruhlar uchun ruxsat berilsin? *
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 p-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                  {groups.map((group) => {
                    const checked = selectedGroupIds.includes(group.id);
                    return (
                      <label
                        key={group.id}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-xs cursor-pointer font-medium text-slate-800 dark:text-slate-200"
                      >
                        <input
                          type="checkbox"
                          disabled={isCreatingExam}
                          checked={checked}
                          onChange={() => toggleGroupSelection(group.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{group.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  disabled={isCreatingExam}
                  onClick={() => {
                    setIsExamModalOpen(false);
                    setEditingExam(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isCreatingExam}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isCreatingExam && <InlineSpinner className="w-3.5 h-3.5" />}
                  <span>
                    {isCreatingExam
                      ? 'Saqlanmoqda...'
                      : editingExam
                      ? "O'zgarishlarni Saqlash"
                      : 'Nazoratni Saqlash'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: START / CONFIGURE GROUP & DURATION
         ======================================================== */}
      {startConfigExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-600" />
              {startOnlyUpdate ? 'Guruh va Davomiylikni Sozlash' : 'Nazoratga START Berish'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              <strong>{startConfigExam.title}</strong> qaysi guruhda va necha daqiqa davom etishini tanlang.
            </p>

            {startConfigError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{startConfigError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmStartOrUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nazorat davomiyligi (daqiqa) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={240}
                  required
                  disabled={isSavingStartConfig}
                  value={startDuration}
                  onChange={(e) => setStartDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Qaysi guruh(lar) uchun ruxsat / START berilsin? *
                </label>
                <div className="space-y-1.5 max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-700 p-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                  {groups.map((group) => {
                    const checked = startGroupIds.includes(group.id);
                    return (
                      <label
                        key={group.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-xs cursor-pointer font-medium text-slate-800 dark:text-slate-200"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={isSavingStartConfig}
                            checked={checked}
                            onChange={() => toggleStartGroupSelection(group.id)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="font-mono font-bold">{group.name}</span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {students.filter((u) => u.groupId === group.id).length} o'quvchi
                        </span>
                      </label>
                    );
                  })}
                </div>
                {startGroupIds.length === 0 && (
                  <p className="text-[11px] text-rose-600 mt-1">Kamida bitta guruh tanlang!</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSavingStartConfig}
                  onClick={() => setStartConfigExam(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={startGroupIds.length === 0 || isSavingStartConfig}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingStartConfig && <InlineSpinner className="w-3.5 h-3.5" />}
                  <span>
                    {isSavingStartConfig
                      ? 'Saqlanmoqda...'
                      : startOnlyUpdate
                      ? 'Saqlash'
                      : 'Tanlangan Guruhda START Berish'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DETAILED STUDENT ANSWERS & AUDIT LOG
         ======================================================== */}
      {inspectSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                  O'quvchi Natijasi va Javoblar Tahlili
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-400 font-medium">Ball / Foiz</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {inspectSession.score} / {inspectSession.totalScore} ({inspectSession.percentage}%)
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-400 font-medium">Baho</div>
                  <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {inspectSession.status === 'in_progress'
                      ? 'Jarayonda'
                      : `${inspectSession.grade ?? computeGrade(inspectSession.percentage)} baho`}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-400 font-medium">Sarflangan Vaqt</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {Math.floor(inspectSession.timeSpentSeconds / 60)} daq {inspectSession.timeSpentSeconds % 60} son
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-400 font-medium">Anti-Cheat</div>
                  <div
                    className={`text-sm font-bold mt-0.5 ${
                      inspectSession.violationsCount >= 3
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {inspectSession.violationsCount} / 3 ta
                  </div>
                </div>
              </div>

              {inspectSession.terminationReason && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs">
                  <strong className="font-bold flex items-center gap-1.5 mb-1">
                    <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    Chetlatish Asosi:
                  </strong>
                  {inspectSession.terminationReason}
                </div>
              )}

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-3">
                  Har bir savolga berilgan javoblar:
                </h4>
                {isLoadingInspectQuestions ? (
                  <PageLoader compact text="O'quvchi javoblari yuklanmoqda..." />
                ) : inspectQuestions.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    Savol javoblari hali belgilanmagan.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {inspectQuestions.map((q, index) => {
                      const selectedOptId = inspectSession.answers?.[q.id];
                      const isCorrect = selectedOptId === q.correctOptionId;
                      return (
                        <div
                          key={q.id}
                          className={`p-4 rounded-2xl border text-xs space-y-2 ${
                            isCorrect
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <strong className="text-slate-900 dark:text-white text-xs sm:text-sm">
                              {index + 1}. {q.questionText}
                            </strong>
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold shrink-0 inline-flex items-center gap-1 ${
                                isCorrect
                                  ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {isCorrect ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                              {isCorrect ? `+${q.points} ball` : '0 ball'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {q.options.map((opt) => {
                              const picked = selectedOptId === opt.id;
                              const isTrue = q.correctOptionId === opt.id;
                              return (
                                <div
                                  key={opt.id}
                                  className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                                    isTrue
                                      ? 'bg-emerald-100/80 dark:bg-emerald-900/50 border-emerald-400 text-emerald-950 dark:text-emerald-200 font-bold'
                                      : picked
                                      ? 'bg-rose-100/80 dark:bg-rose-900/50 border-rose-400 text-rose-950 dark:text-rose-200 font-semibold'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  <span>{opt.text}</span>
                                  {picked && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold shrink-0">
                                      Tanlangan
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              {inspectQuestions.length > 0 ? (
                  <button
                    type="button"
                    disabled={exportingStudentKey === inspectSession.id}
                    onClick={async () => {
                      const targetExam = exams.find((e) => e.id === inspectSession.examId);
                      if (!targetExam) return;
                      setExportingStudentKey(inspectSession.id);
                      try {
                        const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
                        const details: QuestionAnswerAudit[] = inspectQuestions.map((q, idx) => {
                          const selectedOptId = inspectSession.answers?.[q.id];
                          const selectedIdx = q.options.findIndex((o) => o.id === selectedOptId);
                          const correctIdx = q.options.findIndex((o) => o.id === q.correctOptionId);
                          const selectedOpt = selectedIdx >= 0 ? q.options[selectedIdx] : undefined;
                          const correctOpt = correctIdx >= 0 ? q.options[correctIdx] : undefined;
                          return {
                            index: idx + 1,
                            questionId: q.id,
                            questionText: q.questionText,
                            selectedLetter: selectedIdx >= 0 ? OPTION_LETTERS[selectedIdx] || String(selectedIdx + 1) : '',
                            selectedText: selectedOpt?.text || 'Belgilanmagan',
                            correctLetter: correctIdx >= 0 ? OPTION_LETTERS[correctIdx] || String(correctIdx + 1) : '?',
                            correctText: correctOpt?.text || "Noma'lum",
                            isCorrect: !selectedOptId ? null : selectedOptId === q.correctOptionId,
                          };
                        });
                        const correctCnt = details.filter((d) => d.isCorrect === true).length;
                        const isFinished = inspectSession.status !== 'in_progress';
                        await exportSingleStudentReportToExcel({
                          exam: targetExam,
                          subjectName: targetExam.subjectName || inspectSession.subjectName,
                          row: {
                            student: {
                              id: inspectSession.studentId,
                              fullName: inspectSession.studentName,
                              studentId: inspectSession.studentId,
                              role: 'STUDENT',
                              groupId: inspectSession.groupId,
                              groupName: inspectSession.groupName,
                              createdAt: inspectSession.startedAt,
                            },
                            session: inspectSession,
                            variant: inspectSession.variant ?? inspectQuestions[0]?.variant,
                            correctCount: correctCnt,
                            totalQuestions: details.length,
                            percentage: isFinished ? inspectSession.percentage : 0,
                            grade: isFinished ? inspectSession.grade ?? computeGrade(inspectSession.percentage) : null,
                            passed: Boolean(isFinished && inspectSession.passed),
                            questionDetails: details,
                          },
                        });
                      } finally {
                        setExportingStudentKey(null);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {exportingStudentKey === inspectSession.id ? (
                      <InlineSpinner className="w-4 h-4" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                    <span>
                      {exportingStudentKey === inspectSession.id
                        ? 'Tayyorlanmoqda...'
                        : 'Shaxsiy Excel (.xlsx) Yuklab Olish'}
                    </span>
                  </button>
              ) : (
                <div />
              )}
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

      {/* ========================================================
          MODAL: DELETE SUBJECT / EXAM CONFIRMATION
         ======================================================== */}
      {deletingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              Fanni o'chirish
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
              Haqiqatan ham <strong>{deletingSubject.name}</strong> fanini va unga tegishli nazorat ishlarini o'chirishni xohlaysizmi?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingSubject(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleConfirmDeleteSubject()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {isDeleting && <InlineSpinner className="w-3.5 h-3.5" />}
                <span>{isDeleting ? "O'chirilmoqda..." : "Ha, O'chirish"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              Nazorat ishini o'chirish
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
              Haqiqatan ham <strong>{deletingExam.title}</strong> nazorat ishini o'chirishni xohlaysizmi?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingExam(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleConfirmDeleteExam()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {isDeleting && <InlineSpinner className="w-3.5 h-3.5" />}
                <span>{isDeleting ? "O'chirilmoqda..." : "Ha, O'chirish"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
