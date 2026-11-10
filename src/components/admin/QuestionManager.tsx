/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Question, Exam } from '../../types';
import { mongoService } from '../../services/mongoService';
import {
  HelpCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Award,
  FileQuestion,
  Code,
  Upload,
  ArrowLeft,
  FileCode,
  Copy,
  Check,
  Download,
  AlertCircle,
  FileText,
  Layers,
  Edit2,
} from 'lucide-react';
import { InlineSpinner, PageLoader } from '../ui/Loader';

export const QuestionManager: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedVariantFilter, setSelectedVariantFilter] = useState<'all' | number>('all');

  // Create / Edit question form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOpt, setCorrectOpt] = useState<'opt-a' | 'opt-b' | 'opt-c' | 'opt-d'>('opt-a');
  const [points, setPoints] = useState<number>(1);
  const [questionVariant, setQuestionVariant] = useState<number>(1);
  const [explanation, setExplanation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // JSON Bulk Upload modal state (5 variants x 20 questions = 100 questions)
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonSuccess, setJsonSuccess] = useState<string | null>(null);
  const [isUploadingJson, setIsUploadingJson] = useState(false);
  const [isCopiedExample, setIsCopiedExample] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isCreatingQuestion, setIsCreatingQuestion] = useState(false);

  // Single-step delete confirmation modal
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    void refresh();
  }, [selectedExamId]);

  const refresh = async (silent = false) => {
    try {
      const loadedExams = await mongoService.getExams({ silent });
      setExams(loadedExams);
      const validExamId =
        selectedExamId && loadedExams.some((exam) => exam.id === selectedExamId)
          ? selectedExamId
          : null;
      if (validExamId !== selectedExamId) setSelectedExamId(validExamId);
      if (validExamId) {
        if (!silent) setIsLoadingQuestions(true);
        try {
          setQuestions(await mongoService.getQuestions(validExamId, false, { silent }));
        } finally {
          if (!silent) setIsLoadingQuestions(false);
        }
      } else {
        setQuestions([]);
      }
    } catch (error) {
      console.error('Savollarni yuklab bo‘lmadi:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleExamSelect = (examId: string) => {
    setSelectedVariantFilter('all');
    setJsonError(null);
    setJsonSuccess(null);
    setIsLoadingQuestions(true);
    setSelectedExamId(examId);
  };

  const slotKeys: Array<'opt-a' | 'opt-b' | 'opt-c' | 'opt-d'> = ['opt-a', 'opt-b', 'opt-c', 'opt-d'];

  const openCreateQuestionModal = () => {
    setEditingQuestion(null);
    setQuestionText('');
    setCodeSnippet('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setCorrectOpt('opt-a');
    setPoints(1);
    setQuestionVariant(typeof selectedVariantFilter === 'number' ? selectedVariantFilter : 1);
    setExplanation('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditQuestionModal = (q: Question) => {
    setEditingQuestion(q);
    setQuestionText(q.questionText || '');
    setCodeSnippet(q.codeSnippet || '');
    setOptionA(q.options[0]?.text || '');
    setOptionB(q.options[1]?.text || '');
    setOptionC(q.options[2]?.text || '');
    setOptionD(q.options[3]?.text || '');
    const correctIndex = q.options.findIndex((o) => o.id === q.correctOptionId);
    setCorrectOpt(correctIndex >= 0 && correctIndex < 4 ? slotKeys[correctIndex] : 'opt-a');
    setPoints(q.points || 1);
    setQuestionVariant(q.variant || 1);
    setExplanation(q.explanation || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId) return;
    setFormError(null);

    if (!questionText.trim() || !optionA.trim() || !optionB.trim()) {
      setFormError("Iltimos, savol matni va kamida 2 ta variantni kiriting!");
      return;
    }

    const slotValues = [optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim()];
    const selectedSlotIdx = slotKeys.indexOf(correctOpt);
    if (selectedSlotIdx < 0 || !slotValues[selectedSlotIdx]) {
      setFormError("Tanlangan to'g'ri javob varianti bo'sh bo'lmasligi kerak!");
      return;
    }

    // Preserve existing option IDs when editing (handles both 'opt-a'..'opt-d' and bulk 'opt-1'..'opt-4')
    const defaultIds = editingQuestion?.options.some((o) => o.id.startsWith('opt-1'))
      ? ['opt-1', 'opt-2', 'opt-3', 'opt-4']
      : slotKeys;

    const slotIds = slotKeys.map(
      (_, idx) => editingQuestion?.options[idx]?.id || defaultIds[idx]
    );

    const optionsList = slotValues
      .map((text, idx) => ({ id: slotIds[idx], text }))
      .filter((opt) => opt.text.length > 0);

    const resolvedCorrectOptionId = slotIds[selectedSlotIdx];

    setIsCreatingQuestion(true);
    try {
      if (editingQuestion) {
        await mongoService.updateQuestion(editingQuestion.id, {
          variant: questionVariant,
          questionText: questionText.trim(),
          codeSnippet: codeSnippet.trim(),
          options: optionsList,
          correctOptionId: resolvedCorrectOptionId,
          points: Number(points) || 1,
          explanation: explanation.trim(),
        });
      } else {
        const newQuestion: Question = {
          id: `q-${Date.now()}`,
          examId: selectedExamId,
          variant: questionVariant,
          questionText: questionText.trim(),
          codeSnippet: codeSnippet.trim() || undefined,
          options: optionsList,
          correctOptionId: resolvedCorrectOptionId,
          points: Number(points) || 1,
          explanation: explanation.trim() || undefined,
        };
        await mongoService.createQuestion(newQuestion);
      }

      await refresh(true);
      setEditingQuestion(null);
      setQuestionText('');
      setCodeSnippet('');
      setOptionA('');
      setOptionB('');
      setOptionC('');
      setOptionD('');
      setCorrectOpt('opt-a');
      setPoints(1);
      setExplanation('');
      setIsModalOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Savolni saqlashda xatolik');
    } finally {
      setIsCreatingQuestion(false);
    }
  };

  const handleConfirmDeleteQuestion = async () => {
    if (!selectedExamId || !deletingQuestion) return;
    setIsDeleting(true);
    try {
      await mongoService.deleteQuestion(selectedExamId, deletingQuestion.id);
      await refresh(true);
      setDeletingQuestion(null);
    } catch (error) {
      console.error('Savolni o‘chirishda xatolik:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Sample JSON preview (compact preview showing 5 variants structure)
  const sampleJsonPreview = JSON.stringify(
    {
      variants: [
        {
          questions: [
            {
              text: "TypeScript-da o'zgarmas xususiyat qaysi kalit so'z bilan belgilanadi?",
              options: ["readonly", "static", "mutable", "volatile"],
              correctAnswer: 0,
            },
          ],
        },
        {
          questions: [
            {
              text: "2-variant savoli...",
              options: ["A javob", "B javob", "C javob", "D javob"],
              correctAnswer: 1,
            },
          ],
        },
      ],
    },
    null,
    2
  );

  const handleCopyExample = () => {
    navigator.clipboard.writeText(sampleJsonPreview);
    setIsCopiedExample(true);
    setTimeout(() => setIsCopiedExample(false), 2000);
  };

  const downloadVariantTemplate = () => {
    const template = {
      variants: Array.from({ length: 5 }, (_, vIdx) => ({
        questions: Array.from({ length: 20 }, (__, qIdx) => ({
          text: `${vIdx + 1}-variant, ${qIdx + 1}-savol matni`,
          options: ['A variant', 'B variant', 'C variant', 'D variant'],
          correctAnswer: 0,
        })),
      })),
    };
    const link = document.createElement('a');
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    );
    link.download = 'nazorat-5-variant-100-savol-namuna.json';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonText((event.target?.result as string) || '');
      setJsonError(null);
    };
    reader.readAsText(file);
  };

  const handleProcessJsonUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setJsonError(null);
    setJsonSuccess(null);

    if (!selectedExamId || !jsonText.trim()) {
      setJsonError("Iltimos, JSON faylni tanlang yoki matnni kiriting!");
      return;
    }

    setIsUploadingJson(true);
    try {
      const parsed: unknown = JSON.parse(jsonText);
      const rawVariants = Array.isArray(parsed)
        ? parsed
        : (parsed as { variants?: unknown }).variants;

      if (!Array.isArray(rawVariants) || rawVariants.length !== 5) {
        setJsonError("JSON fayl aniq 5 ta variantdan iborat bo‘lishi kerak (variants: [ ...5 ta... ]).");
        setIsUploadingJson(false);
        return;
      }

      const invalidIdx = rawVariants.findIndex(
        (v: any) => !Array.isArray(v?.questions) || v.questions.length !== 20
      );
      if (invalidIdx >= 0) {
        setJsonError(
          `${invalidIdx + 1}-variantda savollar soni aniq 20 ta bo‘lishi kerak (jami 5 × 20 = 100 ta savol).`
        );
        setIsUploadingJson(false);
        return;
      }

      const result = await mongoService.bulkUploadQuestions(selectedExamId, rawVariants);
      await refresh(true);
      setSelectedVariantFilter('all');
      setJsonSuccess(
        `Muvaffaqiyatli! ${result.variants} ta variant (${result.count} ta savol) MongoDB’ga saqlandi.`
      );
      setJsonText('');
      setTimeout(() => {
        setIsJsonModalOpen(false);
        setJsonSuccess(null);
      }, 1400);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'JSON fayl strukturasi noto‘g‘ri.');
    } finally {
      setIsUploadingJson(false);
    }
  };

  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const availableVariants = Array.from(
    new Set(questions.map((q) => q.variant).filter((v): v is number => typeof v === 'number'))
  ).sort((a, b) => a - b);

  const visibleQuestions =
    selectedVariantFilter === 'all'
      ? questions
      : questions.filter((q) => q.variant === selectedVariantFilter);

  if (isLoading && exams.length === 0) {
    return <PageLoader text="Savollar banki yuklanmoqda..." />;
  }

  return (
    <div className="space-y-6">
      {/* ========================================================
          VIEW 1: NAZORATLAR RO'YXATI (Guruhlar dizaynida)
         ======================================================== */}
      {!selectedExamId ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Savollar Banki (Nazoratlar Ro'yxati)
                </h2>
                <span className="text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  {exams.length} ta nazorat
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Nazorat ishi ustiga bosing va alohida sahifada kirib savollarni birma-bir yoki 5 variantli (100 savol) JSON fayl orqali yuklang.
              </p>
            </div>
          </div>

          {exams.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
              <FileQuestion className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Hozircha nazorat ishlari yaratilmagan
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Avval "Fanlar & Nazoratlar" bo'limidan nazorat ishi yarating.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  onClick={() => void handleExamSelect(exam.id)}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-[11px] font-black px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 uppercase">
                        {exam.type.replace('_', ' ')}
                      </span>
                      {exam.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          FAOL
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          {exam.durationMinutes} daqiqa
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                      {exam.title}
                    </h4>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                      {exam.subjectName}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      {exam.questionCount} ta savol (1 urinish)
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Savollarga kirish →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================
            VIEW 2: ALOHIDA NAZORAT SAVOLLARI SAHIFASI
           ======================================================== */
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top Bar */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors">
            <div className="flex items-start sm:items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedExamId(null)}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Nazoratlarga qaytish</span>
              </button>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {selectedExam?.title}
                  </h2>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {selectedExam?.subjectName}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Jami bazada: <strong>{questions.length} ta</strong> savol • O'quvchiga tasodifiy 1 variant (20 ta savol) beriladi
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setJsonText('');
                  setJsonError(null);
                  setJsonSuccess(null);
                  setIsJsonModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileCode className="w-4 h-4 text-indigo-500" />
                <span>JSON 5 Variant Yuklash</span>
              </button>

              <button
                type="button"
                onClick={openCreateQuestionModal}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Bittalik Savol</span>
              </button>
            </div>
          </div>

          {/* Grading scale & Variant filter bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-indigo-900 dark:text-indigo-200">Baholash mezoni:</span>
              <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold">0–59%: 2</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">60–69%: 3</span>
              <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">70–89%: 4</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">90–100%: 5</span>
            </div>

            {availableVariants.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedVariantFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    selectedVariantFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Barchasi ({questions.length})
                </button>
                {availableVariants.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSelectedVariantFilter(v)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      selectedVariantFilter === v
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {v}-variant ({questions.filter((q) => q.variant === v).length})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Questions List */}
          <div className="space-y-4">
            {isLoadingQuestions ? (
              <PageLoader compact text="Nazorat savollari yuklanmoqda..." />
            ) : visibleQuestions.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
                <FileQuestion className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Hozircha savollar mavjud emas
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-4 max-w-md mx-auto">
                  Savollarni birma-bir qo'shishingiz yoki 5 ta variantli (har birida 20 tadan, jami 100 ta savol) JSON fayl orqali bir zumda yuklashingiz mumkin.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setJsonText('');
                      setJsonError(null);
                      setJsonSuccess(null);
                      setIsJsonModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileCode className="w-4 h-4 text-indigo-500" />
                    JSON 5 Variant Yuklash
                  </button>
                  <button
                    type="button"
                    onClick={openCreateQuestionModal}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Bittalik savol qo'shish
                  </button>
                </div>
              </div>
            ) : (
              visibleQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {q.variant && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                              {q.variant}-variant
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                          {q.questionText}
                        </h4>

                        {q.codeSnippet && (
                          <div className="mt-2 p-2.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-xs overflow-x-auto">
                            <pre>{q.codeSnippet}</pre>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800 mr-1">
                        <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        {q.points} ball
                      </span>

                      <button
                        type="button"
                        onClick={() => openEditQuestionModal(q)}
                        className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors"
                        title="Savolni tahrirlash"
                        aria-label="Savolni tahrirlash"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingQuestion(q)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                        title="Savolni o'chirish"
                        aria-label="Savolni o'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {q.options.map((opt) => {
                      const isCorrect = opt.id === q.correctOptionId;
                      return (
                        <div
                          key={opt.id}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                            isCorrect
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-semibold'
                              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span>{opt.text}</span>
                          {isCorrect && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded font-bold shrink-0 ml-2">
                              <CheckCircle2 className="w-3 h-3" />
                              To'g'ri javob
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                      Izoh: {q.explanation}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 1: BITTALIK SAVOL QO'SHISH / TAHRIRLASH
         ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              {editingQuestion ? 'Savolni Tahrirlash' : "Yangi Savol Qo'shish"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Savol matni, javob variantlari va to'g'ri javobni belgilang.
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Savol Matni *
                </label>
                <textarea
                  required
                  rows={3}
                  disabled={isCreatingQuestion}
                  placeholder="masalan: Qaysi operator JavaScript-da qat'iy tenglikni bildiradi?"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Code className="w-3.5 h-3.5 text-slate-400" />
                  Kod bo'lagi yoki Formula (ixtiyoriy)
                </label>
                <textarea
                  rows={2}
                  disabled={isCreatingQuestion}
                  placeholder="masalan: const x = () => { ... }"
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Javob Variantlari va To'g'ri Javobni tanlang: *
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct_option"
                    disabled={isCreatingQuestion}
                    checked={correctOpt === 'opt-a'}
                    onChange={() => setCorrectOpt('opt-a')}
                    className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <input
                    type="text"
                    required
                    disabled={isCreatingQuestion}
                    placeholder="Variant A"
                    value={optionA}
                    onChange={(e) => setOptionA(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct_option"
                    disabled={isCreatingQuestion}
                    checked={correctOpt === 'opt-b'}
                    onChange={() => setCorrectOpt('opt-b')}
                    className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <input
                    type="text"
                    required
                    disabled={isCreatingQuestion}
                    placeholder="Variant B"
                    value={optionB}
                    onChange={(e) => setOptionB(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct_option"
                    disabled={isCreatingQuestion}
                    checked={correctOpt === 'opt-c'}
                    onChange={() => setCorrectOpt('opt-c')}
                    className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <input
                    type="text"
                    disabled={isCreatingQuestion}
                    placeholder="Variant C"
                    value={optionC}
                    onChange={(e) => setOptionC(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct_option"
                    disabled={isCreatingQuestion}
                    checked={correctOpt === 'opt-d'}
                    onChange={() => setCorrectOpt('opt-d')}
                    className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <input
                    type="text"
                    disabled={isCreatingQuestion}
                    placeholder="Variant D"
                    value={optionD}
                    onChange={(e) => setOptionD(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Variant (1–5)
                  </label>
                  <select
                    disabled={isCreatingQuestion}
                    value={questionVariant}
                    onChange={(e) => setQuestionVariant(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer disabled:opacity-60"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        {v}-variant
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Savol Bali
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    disabled={isCreatingQuestion}
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Izoh (ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    disabled={isCreatingQuestion}
                    placeholder="Sababi..."
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  disabled={isCreatingQuestion}
                  onClick={() => {
                    setEditingQuestion(null);
                    setIsModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isCreatingQuestion}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isCreatingQuestion && <InlineSpinner className="w-3.5 h-3.5" />}
                  <span>
                    {isCreatingQuestion
                      ? 'Saqlanmoqda...'
                      : editingQuestion
                      ? "O'zgarishlarni Saqlash"
                      : 'Savolni Saqlash'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: JSON ORQALI 5 VARIANT (100 SAVOL) YUKLASH
         ======================================================== */}
      {isJsonModalOpen && selectedExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full">
                  5 Variant × 20 Savol = 100 Savol (JSON Import)
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  Savollarni JSON Fayl Orqali Yuklash
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nazorat: <strong className="text-indigo-600 dark:text-indigo-400">{selectedExam.title}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsJsonModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {jsonError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}

            {jsonSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{jsonSuccess}</span>
              </div>
            )}

            {/* JSON Structure Guide */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mb-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    JSON Strukturasi (5 Variant × 20 Savol, 4 Javobli):
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyExample}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                  >
                    {isCopiedExample ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopiedExample ? 'Nusxalandi' : 'Nusxa olish'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={downloadVariantTemplate}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer hover:bg-indigo-100"
                  >
                    <Download className="w-3 h-3" />
                    <span>100 savollik namuna (.json)</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl overflow-x-auto text-emerald-400 font-mono text-[11px]">
                <pre>{sampleJsonPreview}</pre>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                💡 <strong>Muhim:</strong> <code className="font-mono text-indigo-600 dark:text-indigo-400">variants</code> massivida aniq <strong>5 ta variant</strong> va har bir variantda aniq <strong>20 ta savol</strong> bo‘lishi shart. Har bir savolda 4 ta <code className="font-mono">options</code> va <code className="font-mono">correctAnswer</code> (0 = 1-javob, 1 = 2-javob, 2 = 3-javob, 3 = 4-javob) ko‘rsatiladi. Yuklanganda ushbu nazoratning avvalgi savollari yangilanadi.
              </p>
            </div>

            <form onSubmit={handleProcessJsonUpload} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    JSON Fayl Tanlang yoki Matnni Kiriting:
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="application/json,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Kompyuterdan .json faylni tanlash
                  </button>
                </div>

                <textarea
                  rows={6}
                  placeholder='{ "variants": [ { "questions": [ ...20 ta savol... ] }, ...5 ta variant... ] }'
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  className="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {isUploadingJson && (
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-2">
                  <InlineSpinner className="w-4 h-4" />
                  <span>100 ta savol (5 variant) bazaga saqlanmoqda...</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isUploadingJson}
                  onClick={() => setIsJsonModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isUploadingJson}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
                >
                  {isUploadingJson ? <InlineSpinner className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                  <span>{isUploadingJson ? 'Saqlanmoqda...' : 'MongoDB’ga Yuklash'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: SAVOLNI O'CHIRISH TASDIG'I (Single confirmation)
         ======================================================== */}
      {deletingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              Savolni o'chirish
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
              Haqiqatan ham ushbu savolni bazadan o'chirishni xohlaysizmi?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingQuestion(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleConfirmDeleteQuestion()}
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
