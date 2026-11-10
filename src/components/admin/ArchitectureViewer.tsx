/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Database,
  FolderTree,
  Shield,
  Check,
  Copy,
  Zap,
  TrendingUp,
  Cpu,
  Layers,
  FileCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { mongoService } from '../../services/mongoService';
import { InlineSpinner } from '../ui/Loader';

export const ArchitectureViewer: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<
    'models' | 'comparison' | 'structure' | 'queries'
  >('models');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [clusterInfo, setClusterInfo] = useState<{
    connected: boolean;
    cluster: string;
    database: string;
    username: string;
    counts?: {
      users: number;
      groups: number;
      subjects: number;
      exams: number;
      questions: number;
      sessions: number;
    };
  } | null>(null);

  const [isLoadingCluster, setIsLoadingCluster] = useState(true);

  React.useEffect(() => {
    setIsLoadingCluster(true);
    void mongoService
      .request<{
        success: boolean;
        connected: boolean;
        cluster: string;
        database: string;
        username: string;
        counts?: {
          users: number;
          groups: number;
          subjects: number;
          exams: number;
          questions: number;
          sessions: number;
        };
      }>('/api/mongodb/status', undefined, { silent: true })
      .then((data) => {
        if (data && data.success) setClusterInfo(data);
      })
      .catch(() => {
        setClusterInfo({
          connected: false,
          cluster: 'cluster0.runvins.mongodb.net',
          database: 'eduexam_secure',
          username: 'local_fallback',
        });
      })
      .finally(() => setIsLoadingCluster(false));
  }, []);

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const mongoSchemas = {
    users: `// Collection: users
// Schema: src/models/User.ts
{
  "_id": "ObjectId",
  "fullName": "String (talaba yoki o'qituvchi F.I.Sh)",
  "email": "String? (faqat Admin uchun zarur, lowercase, unique)",
  "studentId": "String? (avtomatik: 'EDU-0126-001', indexed)",
  "password": "String (Admin tayinlagan yoki avtomatik '0126-Anvar')",
  "role": "'ADMIN' | 'STUDENT' (default: 'STUDENT', indexed)",
  "groupId": "ObjectId (ref: 'Group', indexed)",
  "groupName": "String? (masalan: '01-26', 'KTD04-26')",
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}

// MongoDB Indexes:
// UserSchema.index({ groupId: 1, role: 1 });
// UserSchema.index({ studentId: 1 }, { unique: true, sparse: true });`,

    groups: `// Collection: groups
// Schema: src/models/Group.ts
{
  "_id": "ObjectId",
  "name": "String ('01-26', '02-26', 'KTD04-26', unique, indexed)",
  "description": "String?",
  "studentCount": "Number (guruhdagi talabalar soni, default: 0)",
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}

// MongoDB Indexes:
// GroupSchema.index({ name: 1 }, { unique: true });`,

    subjects: `// Collection: subjects
// Schema: src/models/Subject.ts
{
  "_id": "ObjectId",
  "name": "String (masalan: 'Algoritmlar', 'Frontend Web')",
  "code": "String (masalan: 'ALG-101', uppercase, unique, indexed)",
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}`,

    exams: `// Collection: exams
// Schema: src/models/Exam.ts
{
  "_id": "ObjectId",
  "subjectId": "ObjectId (ref: 'Subject', indexed)",
  "subjectName": "String",
  "title": "String (masalan: '1-Oraliq nazorat')",
  "type": "'ORALIQ_1' | 'ORALIQ_2' | 'YAKUNIY'",
  "durationMinutes": "Number (daqiqalarda, masalan: 20)",
  "passingScore": "Number (o'tish foizi, masalan: 60)",
  "maxAttempts": "Number (default: 1)",
  "groupIds": ["String"] (biriktirilgan guruhlar: ['01-26', '02-26'])",
  "isActive": "Boolean (START = true, STOP = false, indexed)",
  "startedAt": "ISODate?",
  "stoppedAt": "ISODate?",
  "totalPoints": "Number",
  "questionCount": "Number",
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}

// MongoDB Compound Index for real-time exam querying:
// ExamSchema.index({ groupIds: 1, isActive: 1 });`,

    questions: `// Collection: questions
// Schema: src/models/Question.ts
{
  "_id": "ObjectId",
  "examId": "ObjectId (ref: 'Exam', indexed)",
  "questionText": "String",
  "codeSnippet": "String?",
  "options": [
    { "id": "opt-a", "text": "useMemo" },
    { "id": "opt-b", "text": "useCallback" },
    { "id": "opt-c", "text": "useEffect" },
    { "id": "opt-d", "text": "useRef" }
  ],
  "correctOptionId": "String (Talaba API so'rovida .select('-correctOptionId') bilan yashiriladi)",
  "points": "Number (default: 5)",
  "explanation": "String?",
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}`,

    exam_sessions: `// Collection: exam_sessions
// Schema: src/models/ExamSession.ts
{
  "_id": "ObjectId",
  "examId": "ObjectId (ref: 'Exam', indexed)",
  "examTitle": "String",
  "subjectName": "String",
  "studentId": "String ('EDU-0126-001', indexed)",
  "studentName": "String",
  "groupId": "String ('01-26', indexed)",
  "groupName": "String",
  "status": "'in_progress' | 'completed' | 'terminated' (indexed)",
  "startedAt": "ISODate",
  "submittedAt": "ISODate?",
  "timeSpentSeconds": "Number",
  "answers": {
    "question_id_1": "opt-b",
    "question_id_2": "opt-a"
  },
  "score": "Number",
  "totalScore": "Number",
  "percentage": "Number",
  "passed": "Boolean",
  "violationsCount": "Number (0-3, $inc operatori orqali oshiriladi)",
  "terminationReason": "String?",
  "violations": [
    {
      "id": "String",
      "type": "'tab_switch' | 'window_blur' | 'fullscreen_exit' | 'forbidden_key'",
      "timestamp": "ISODate",
      "details": "String"
    }
  ],
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}

// High concurrency indexes (bir vaqtda 500+ o'quvchi topshirganda qotmasligi uchun):
// ExamSessionSchema.index({ examId: 1, studentId: 1 }, { unique: true });
// ExamSessionSchema.index({ examId: 1, status: 1 });`,
  };

  const projectStructureTree = `eduexam-secure/
├── src/
│   ├── models/                            # Mongoose Schemas & BSON Modellari
│   │   ├── User.ts                        # Admin va Talaba (EDU- ID, Guruhlar)
│   │   ├── Group.ts                       # Guruhlar ('01-26', 'KTD04-26')
│   │   ├── Subject.ts                     # Fanlar (Matematika, Dasturlash)
│   │   ├── Exam.ts                        # Nazorat ishlari (START/STOP)
│   │   ├── Question.ts                    # Savollar va variantlar
│   │   ├── ExamSession.ts                 # Anti-Cheat sessiyalari va qoidabuzarliklar
│   │   └── index.ts
│   ├── lib/
│   │   ├── mongodb.ts                     # MongoDB Atlas ulanish pool'i (maxPoolSize=50)
│   │   └── utils.ts
│   ├── services/
│   │   ├── mongoService.ts                # Atomic $inc, $push, Aggregation Pipeline
│   │   └── storageService.ts              # LocalStorage fallback & sinxronizatsiya
│   ├── hooks/
│   │   ├── useExamSecurity.ts             # Fullscreen, Tab & Blur anti-cheat
│   │   └── useExamTimer.ts                # Sinxronizatsiya qilingan taymer
│   ├── components/
│   │   ├── admin/                         # Admin boshqaruv paneli
│   │   │   ├── GroupManager.tsx           # Guruhlar va JSON ommaviy yuklash
│   │   │   ├── ExamManager.tsx            # Nazorat ishlari va START/STOP
│   │   │   ├── LiveMonitor.tsx            # Jonli o'quvchilar nazorati
│   │   │   ├── QuestionManager.tsx        # Savollar banki
│   │   │   └── ArchitectureViewer.tsx     # MongoDB arxitekturasi va hujjatlar
│   │   ├── student/                       # O'quvchi mobil interfeysi
│   │   │   ├── ExamTakingView.tsx         # Xavfsiz test topshirish ekrani
│   │   │   ├── ExamResultView.tsx         # Natija va xatoliklar tahlili
│   │   │   └── StudentDashboard.tsx       # Shaxsiy kabinet va savollar tahlili
│   │   └── layout/
│   │       └── Sidebar.tsx                # Chap navigatsiya paneli va Dark/Light mode
│   └── types/
│       └── index.ts                       # TypeScript interfeyslari
├── server.ts                              # Express Backend + Vite Middleware (port 3000)
├── .env.example                           # MONGODB_URI va JWT_SECRET
├── package.json                           # Mongoose, Express, React 19, Tailwind
└── tsconfig.json`;

  const mongoQueriesCode = `// 1. MONGODB ATLAS GA ULANISH (src/lib/mongodb.ts)
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

export async function connectToDatabase() {
  if (mongoose.connection.readyState >= 1) return;
  return mongoose.connect(MONGODB_URI, {
    maxPoolSize: 50, // Bir vaqtda 500+ parallel talabalar oqimi uchun
    serverSelectionTimeoutMS: 5000,
  });
}

// 2. ANTI-CHEAT QOIDABUZARLIKNI ATOMIK YONDIRISH ($inc va $push)
// Firebase'dan farqli o'laroq, hujjatni bloklamaydi va kvota sarflamaydi!
export async function recordViolation(sessionId: string, violation: any) {
  const updatedSession = await ExamSessionModel.findOneAndUpdate(
    { _id: sessionId, status: 'in_progress' },
    {
      $inc: { violationsCount: 1 },
      $push: { violations: violation },
    },
    { new: true }
  );

  // 3-marta qoidabuzarlikda avtomatik to'xtatish
  if (updatedSession && updatedSession.violationsCount >= 3) {
    updatedSession.status = 'terminated';
    updatedSession.terminationReason = "Xavfsizlik qoidalari 3 marta buzildi";
    updatedSession.submittedAt = new Date();
    await updatedSession.save();
  }
  return updatedSession;
}

// 3. MONGODB AGGREGATION PIPELINE (Imtihon tahlili va o'rtacha ball)
export async function getExamAnalytics(examId: string) {
  const result = await ExamSessionModel.aggregate([
    { $match: { examId: new mongoose.Types.ObjectId(examId) } },
    {
      $group: {
        _id: '$examId',
        totalStudents: { $sum: 1 },
        avgScore: { $avg: '$score' },
        highestScore: { $max: '$score' },
        lowestScore: { $min: '$score' },
        passedCount: { $sum: { $cond: ['$passed', 1, 0] } },
        terminatedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'terminated'] }, 1, 0] },
        },
        avgViolations: { $avg: '$violationsCount' },
      },
    },
  ]);
  return result[0];
}`;

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-400/30">
            <Zap className="w-3.5 h-3.5" />
            MongoDB Arxitekturasi va To'liq BSON Strukturasi
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            EduExam Secure — MongoDB Ma'lumotlar Bazasi
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-2 leading-relaxed">
            Firebase bepul tarifining kunlik o'qish/yozish cheklovlari (50,000 / 20,000)
            imtihon paytida yuzlab talabalar bir vaqtda kirganda tezda to'lib qoladi.
            MongoDB esa cheksiz operatsiyalar, atomik <code>$inc</code> va <code>$push</code> operatorlari
            hamda kuchli Aggregation Pipelines orqali eng optimal yechim hisoblanadi.
          </p>

          {/* Live Cluster Connection Info */}
          <div className="mt-4 p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 backdrop-blur-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <div className="font-bold text-white flex items-center gap-1.5 font-mono">
                  <span>{clusterInfo?.connected ? 'MongoDB Atlas Faol' : 'Lokal Baza Rejimi (.data)'}</span>
                  {isLoadingCluster ? (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30 inline-flex items-center gap-1">
                      <InlineSpinner className="w-3 h-3" /> Tekshirilmoqda...
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                      {clusterInfo?.connected ? 'Ulangan' : 'Saqlanuvchi zaxira'}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Klaster: <span className="text-emerald-300">{clusterInfo?.cluster || 'cluster0.runvins.mongodb.net'}</span> • Baza: <span className="text-emerald-300">eduexam_secure</span>
                </div>
              </div>
            </div>

            {clusterInfo?.counts && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span className="bg-slate-800 px-2 py-1 rounded-lg text-slate-300">
                  👥 {clusterInfo.counts.users} foydalanuvchi
                </span>
                <span className="bg-slate-800 px-2 py-1 rounded-lg text-slate-300">
                  🏫 {clusterInfo.counts.groups} guruh
                </span>
                <span className="bg-slate-800 px-2 py-1 rounded-lg text-slate-300">
                  📝 {clusterInfo.counts.exams} nazorat
                </span>
                <span className="bg-slate-800 px-2 py-1 rounded-lg text-slate-300">
                  ❓ {clusterInfo.counts.questions} savol
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-slate-800 relative z-10">
          <button
            onClick={() => setActiveSubTab('models')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'models'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Database className="w-4 h-4" />
            1. Mongoose BSON Modellari (6 ta)
          </button>

          <button
            onClick={() => setActiveSubTab('comparison')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'comparison'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            2. Nima Uchun MongoDB? (Taqoslash)
          </button>

          <button
            onClick={() => setActiveSubTab('structure')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'structure'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            3. Loyiha Papkalar Strukturasi
          </button>

          <button
            onClick={() => setActiveSubTab('queries')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'queries'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FileCode className="w-4 h-4" />
            4. Atomik So'rovlar & Aggregation
          </button>
        </div>

        <div className="absolute right-0 bottom-0 opacity-10 translate-x-10 translate-y-10 pointer-events-none">
          <Database className="w-80 h-80 text-emerald-400" />
        </div>
      </div>

      {/* Tab 1: MongoDB Schemas */}
      {activeSubTab === 'models' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                MongoDB Kolleksiyalari va Mongoose Schemalari:
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Har bir kolleksiya yuqori yuklamalarda tezkor ishlashi uchun compound indekslar bilan ta'minlangan.
              </p>
            </div>
            <span className="text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto font-mono">
              6 ta collection
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(mongoSchemas).map(([colName, schema]) => (
              <div
                key={colName}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:border-emerald-400 dark:hover:border-emerald-700 transition-all flex flex-col"
              >
                <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 uppercase">
                      db.{colName}
                    </span>
                  </div>
                  <button
                    onClick={() => copyText(colName, schema)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Nusxa olish"
                  >
                    {copiedKey === colName ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === colName ? 'Nusxalandi' : 'Nusxa olish'}</span>
                  </button>
                </div>
                <div className="p-3.5 bg-slate-950 overflow-x-auto flex-1 font-mono text-[11px] leading-relaxed text-emerald-400">
                  <pre>{schema}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Comparison - Why MongoDB beats Firebase for Exams */}
      {activeSubTab === 'comparison' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Nima Uchun Nazorat Ishlari (Exam) Uchun MongoDB Tanlandi?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
              Imtihon paytida tizimga 100 yoki 500 nafar o'quvchi bir vaqtda kiradi. Har bir o'quvchi
              har 10 soniyada holatini bildiradi, savollar orasida o'tadi, oynani almashtirganda anti-cheat
              ogohlantirish yoziladi. Quyidagi jadvalda nima uchun Firebase imtihonda qotib qolishi yoki
              juda qimmatga tushishi tushuntirilgan:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4 rounded-l-xl">Mezon (Kriteriy)</th>
                    <th className="py-3 px-4 text-rose-600 dark:text-rose-400">
                      Firebase Firestore (Muammolari)
                    </th>
                    <th className="py-3 px-4 rounded-r-xl text-emerald-600 dark:text-emerald-400">
                      MongoDB (Yechimi va Ustunligi)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      Kunlik Bepul Operatsiyalar
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
                        <XCircle className="w-4 h-4 shrink-0" />
                        20,000 ta yozish / kun cheklovi
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        100 ta o'quvchi test topshirganda 1-2 soatda to'lib, tizim xato beradi!
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        Cheklov yo'q (Unlimited Operations)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        MongoDB Atlas bepul klasterida ham so'rovlar soniga cheklov yo'q.
                      </p>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      Bitta Hujjatga Yozish Tezligi
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        1 soniyada maksimum 1 marta (1 write/sec)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Talaba tez javob belgilasa yoki blur bo'lsa, "Resource Exhausted" xatosi chiqadi.
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        10,000+ operatsiya / soniya
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Barcha parallel hodisalar bir onda mikrosekundlarda bazaga yoziladi.
                      </p>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      Anti-Cheat Atomik Yangilanish
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      Butun hujjatni o'qib, yana qayta yozish kerak (Read + Write narxi).
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      <code className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                        $inc: &#123; violationsCount: 1 &#125;
                      </code>{' '}
                      va <code>$push</code> orqali to'g'ridan-to'g'ri atomik saqlash.
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      Natijalar va Baholar Statistikasi
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      Guruh o'rtacha ballini hisoblash uchun barcha talabalar hujjatlarini o'qish shart (qimmat).
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      <strong>MongoDB Aggregation Pipeline</strong> server tomonida bir necha millisoniyada hisoblab beradi.
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      O'z Serveringizda (VPS/Docker) Ishlatish
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      Faqat Google Cloud Cloud Firestore'ga bog'langan (Vendor Lock-in).
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      MongoDB Atlas bepul bulutida yoki o'z shaxsiy Linux VPS serveringizda 100% bepul ishlaydi.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Structure */}
      {activeSubTab === 'structure' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="bg-slate-50 dark:bg-slate-800/60 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                MongoDB + Express / Next.js To'liq Loyiha Papkalar Strukturasi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Mongoose modellari, Anti-Cheat hooklari, mobil interfeys va MongoDB klienti.
              </p>
            </div>
            <button
              onClick={() => copyText('tree', projectStructureTree)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              {copiedKey === 'tree' ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Nusxalash</span>
            </button>
          </div>
          <div className="p-5 bg-slate-950 overflow-x-auto font-mono text-xs text-emerald-400 leading-relaxed">
            <pre>{projectStructureTree}</pre>
          </div>
        </div>
      )}

      {/* Tab 4: Queries & Aggregation */}
      {activeSubTab === 'queries' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="bg-slate-50 dark:bg-slate-800/60 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <FileCode className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                MongoDB Ulanishi, Atomik Operatorlar va Aggregation Pipeline
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Anti-Cheat hodisalarini qayd qilish va sinf tahlilini hisoblash kodlari.
              </p>
            </div>
            <button
              onClick={() => copyText('queries', mongoQueriesCode)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              {copiedKey === 'queries' ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Kodlarni nusxalash</span>
            </button>
          </div>
          <div className="p-5 bg-slate-950 overflow-x-auto font-mono text-xs text-emerald-400 leading-relaxed">
            <pre>{mongoQueriesCode}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
