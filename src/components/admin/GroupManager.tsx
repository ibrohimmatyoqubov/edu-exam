/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Group, User } from '../../types';
import { mongoService } from '../../services/mongoService';
import {
  Users,
  Plus,
  Trash2,
  UserPlus,
  ArrowLeft,
  KeyRound,
  FileCode,
  Download,
  Copy,
  Check,
  Upload,
  AlertCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Edit2,
  FileText,
  Eye,
  EyeOff,
} from 'lucide-react';
import { InlineSpinner, PageLoader } from '../ui/Loader';

/**
 * Guruh kodi va o'quvchi ma'lumotlari asosida
 * EDU- identifikator va guruh/ismidan kelib chiqadigan parol generatsiyasi
 */
function generateStudentCredentials(
  groupName: string,
  fullName: string,
  existingIndex: number
) {
  // Guruh prefiksi (masalan: "01-26" -> "0126", "KTD04-26" -> "KTD0426")
  const cleanGroup = groupName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'GRP';
  const seqNumber = String(existingIndex + 1).padStart(3, '0');
  const studentId = `EDU-${cleanGroup}-${seqNumber}`;

  // Ismning birinchi qismi (masalan "Anvar Qodirov" -> "Anvar")
  const firstName = fullName.trim().split(/\s+/)[0] || 'Talaba';
  const cleanFirstName = firstName.replace(/[^a-zA-Z0-9а-яА-ЯўқғҳЎҚҒҲ]/g, '');
  const autoPassword = `${cleanGroup}-${cleanFirstName}`;

  return { studentId, autoPassword };
}

export const GroupManager: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Navigation state: null = Faqat guruhlar ko'rinadi; string = Tanlangan guruh sahifasi
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Group creation / edit modal
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');

  // Single student creation modal (EMAIL FIELD OLIB TASHLANDI!)
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentFullName, setStudentFullName] = useState('');
  const [customPassword, setCustomPassword] = useState('');

  // JSON Bulk Upload modal & state
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonSuccess, setJsonSuccess] = useState<string | null>(null);
  const [isCopiedExample, setIsCopiedExample] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick edit password modal
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Full edit student modal (name, studentId, group, password)
  const [editingStudentProfile, setEditingStudentProfile] = useState<User | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [editStudentGroupId, setEditStudentGroupId] = useState('');
  const [editStudentPassword, setEditStudentPassword] = useState('');
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);

  // Single-step delete confirmation modals (replaces window.confirm for iframe compatibility)
  const [deletingStudent, setDeletingStudent] = useState<User | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [isUploadingJson, setIsUploadingJson] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void refreshFromMongo(true);
  }, []);

  const refreshFromMongo = async (showInitialLoader = false) => {
    if (showInitialLoader) setIsLoading(true);
    try {
      const [nextGroups, nextUsers] = await Promise.all([
        mongoService.getGroups(),
        mongoService.getStudents(),
      ]);
      setGroups(nextGroups);
      setUsers(nextUsers);
    } catch (error) {
      console.error('MongoDB ma’lumotlarini yuklashda xatolik:', error);
    } finally {
      if (showInitialLoader) setIsLoading(false);
    }
  };

  const currentGroup = groups.find((g) => g.id === selectedGroupId);
  const currentGroupStudents = users.filter(
    (u) => u.role === 'STUDENT' && u.groupId === selectedGroupId
  );

  const getNextSequenceIndex = () => {
    let maxSeq = currentGroupStudents.length;
    currentGroupStudents.forEach((st) => {
      const match = st.studentId?.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    });
    return maxSeq;
  };

  const openCreateGroupModal = () => {
    setActionError(null);
    setEditingGroup(null);
    setGroupName('');
    setGroupDesc('');
    setIsGroupModalOpen(true);
  };

  const openEditGroupModal = (group: Group) => {
    setActionError(null);
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDesc(group.description || '');
    setIsGroupModalOpen(true);
  };

  // 1. Create or Update Group
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setActionError(null);
    setIsSavingGroup(true);
    try {
      if (editingGroup) {
        await mongoService.updateGroup(editingGroup.id, {
          name: groupName.trim(),
          description: groupDesc.trim(),
        });
        await refreshFromMongo();
        setEditingGroup(null);
        setGroupName('');
        setGroupDesc('');
        setIsGroupModalOpen(false);
      } else {
        const newGroup = await mongoService.createGroup({ name: groupName, description: groupDesc });
        await refreshFromMongo();
        setGroupName('');
        setGroupDesc('');
        setIsGroupModalOpen(false);
        setSelectedGroupId(newGroup.id);
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : editingGroup
          ? 'Guruhni tahrirlashda xatolik yuz berdi'
          : 'Guruh yaratishda xatolik yuz berdi'
      );
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleConfirmDeleteGroup = async () => {
    if (!deletingGroup) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      const targetId = deletingGroup.id;
      await mongoService.deleteGroup(targetId);
      await refreshFromMongo();
      if (selectedGroupId === targetId) setSelectedGroupId(null);
      setDeletingGroup(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Guruhni o‘chirishda xatolik yuz berdi');
    } finally {
      setIsDeleting(false);
    }
  };

  // 2. Create Single Student (Auto EDU- ID and Auto Password)
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFullName.trim() || !currentGroup) return;
    setActionError(null);

    const { studentId, autoPassword } = generateStudentCredentials(
      currentGroup.name,
      studentFullName.trim(),
      getNextSequenceIndex()
    );

    const newStudent: User = {
      id: '',
      fullName: studentFullName.trim(),
      studentId,
      password: customPassword.trim() || autoPassword,
      role: 'STUDENT',
      groupId: currentGroup.id,
      groupName: currentGroup.name,
      createdAt: new Date().toISOString(),
    };

    setIsSavingStudent(true);
    try {
      await mongoService.createStudent(newStudent);
      await refreshFromMongo();
      setStudentFullName('');
      setCustomPassword('');
      setIsStudentModalOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'O‘quvchini qo‘shishda xatolik yuz berdi');
    } finally {
      setIsSavingStudent(false);
    }
  };

  // 3. Delete Student (single confirmation modal -> deletes from MongoDB)
  const handleConfirmDeleteStudent = async () => {
    if (!deletingStudent) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await mongoService.deleteStudent(deletingStudent.id);
      await refreshFromMongo();
      setDeletingStudent(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'O‘quvchini o‘chirishda xatolik yuz berdi');
    } finally {
      setIsDeleting(false);
    }
  };

  // 4. Edit Student Password
  const handleSaveEditedPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !newPasswordValue.trim()) return;
    setActionError(null);
    setIsUpdatingPassword(true);
    try {
      await mongoService.updateStudentPassword(editingStudent.id, newPasswordValue.trim());
      await refreshFromMongo();
      setEditingStudent(null);
      setNewPasswordValue('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Parolni yangilashda xatolik yuz berdi');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // 4b. Full Edit Student Profile (name, studentId, group, password)
  const openEditStudentModal = (student: User) => {
    setActionError(null);
    setEditingStudentProfile(student);
    setEditStudentName(student.fullName);
    setEditStudentId(student.studentId || '');
    setEditStudentGroupId(student.groupId || selectedGroupId || '');
    setEditStudentPassword(student.password || '');
  };

  const handleSaveStudentProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudentProfile || !editStudentName.trim()) return;
    setActionError(null);
    setIsUpdatingStudent(true);
    try {
      const targetGroup = groups.find((g) => g.id === editStudentGroupId);
      await mongoService.updateStudent(editingStudentProfile.id, {
        fullName: editStudentName.trim(),
        studentId: editStudentId.trim() || undefined,
        password: editStudentPassword.trim() || undefined,
        groupId: editStudentGroupId || undefined,
        groupName: targetGroup?.name,
      });
      await refreshFromMongo();
      setEditingStudentProfile(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "O'quvchi ma'lumotlarini yangilashda xatolik yuz berdi"
      );
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  // 5. JSON Bulk Upload Logic
  const sampleJsonExample = JSON.stringify(
    [
      { "fullName": "Anvar Qodirov" },
      { "fullName": "Nilufar Sobirova" },
      { "fullName": "Bobur Mirzayev" },
      { "fullName": "Zarina Karimova" }
    ],
    null,
    2
  );

  const handleDownloadSampleJson = () => {
    const filename = `namuna_oquvchilar_${currentGroup?.name || 'guruh'}.json`;
    const blob = new Blob([sampleJsonExample], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyExample = () => {
    navigator.clipboard.writeText(sampleJsonExample);
    setIsCopiedExample(true);
    setTimeout(() => setIsCopiedExample(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setJsonText(text);
        setJsonError(null);
      } catch {
        setJsonError("Faylni o'qishda xatolik yuz berdi!");
      }
    };
    reader.readAsText(file);
  };

  const handleProcessJsonImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setJsonError(null);
    setJsonSuccess(null);

    if (!jsonText.trim() || !currentGroup) {
      setJsonError("Iltimos, JSON ma'lumotlarini kiriting yoki faylni yuklang!");
      return;
    }

    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        setJsonError("JSON strukturasi ro'yxat (array []) ko'rinishida bo'lishi kerak!");
        return;
      }

      if (parsed.length === 0) {
        setJsonError("JSON ro'yxati bo'sh!");
        return;
      }

      const newStudents: User[] = [];
      const baseSeq = getNextSequenceIndex();

      parsed.forEach((item, index) => {
        const fullName = item.fullName || item.name || item.ism;
        if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
          return;
        }

        const { studentId, autoPassword } = generateStudentCredentials(
          currentGroup.name,
          fullName.trim(),
          baseSeq + index
        );

        const newStudent: User = {
          id: '',
          fullName: fullName.trim(),
          studentId: item.studentId || studentId,
          password: item.password || autoPassword,
          role: 'STUDENT',
          groupId: currentGroup.id,
          groupName: currentGroup.name,
          createdAt: new Date().toISOString(),
        };

        newStudents.push(newStudent);
      });
      const addedCount = newStudents.length;

      if (addedCount > 0) {
        setIsUploadingJson(true);
        try {
          await mongoService.bulkImportStudents(newStudents, currentGroup.id);
          await refreshFromMongo();
          setJsonSuccess(`Muvaffaqiyatli! ${addedCount} nafar o'quvchi ${currentGroup.name} guruhiga qo'shildi.`);
          setJsonText('');
          setTimeout(() => {
            setIsJsonModalOpen(false);
            setJsonSuccess(null);
          }, 1500);
        } finally {
          setIsUploadingJson(false);
        }
      } else {
        setJsonError("Hech qanday o'quvchi topilmadi. Har bir obyektda 'fullName' maydoni bo'lishi kerak.");
      }
    } catch (err: any) {
      setJsonError(`JSON formati noto'g'ri: ${err.message || 'Sintaksis xatosi'}`);
    }
  };

  // Filter students by search
  const filteredStudents = currentGroupStudents.filter((st) => {
    const q = searchQuery.toLowerCase();
    return (
      st.fullName.toLowerCase().includes(q) ||
      (st.studentId && st.studentId.toLowerCase().includes(q))
    );
  });

  if (isLoading) {
    return <PageLoader text="Guruhlar va o'quvchilar yuklanmoqda..." />;
  }

  return (
    <div className="space-y-6">
      {/* ========================================================
          VIEW 1: FAQAT GURUHLAR RO'YXATI (Agar guruh tanlanmagan bo'lsa)
         ======================================================== */}
      {!selectedGroupId ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Guruhlar Ro'yxati
                </h2>
                <span className="text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  {groups.length} ta guruh
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Guruh ustiga bosing va o'quvchilar ro'yxatiga kiring. Yangi guruhlar (masalan: 01-26, 02-26, KTD04-26) yarating.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateGroupModal}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Yangi Guruh Yaratish
            </button>
          </div>

          {/* Groups Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => {
              const groupStudentsCount = users.filter(
                (u) => u.role === 'STUDENT' && u.groupId === group.id
              ).length;

              return (
                <div
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <span className="font-mono text-base font-black px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                        {group.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditGroupModal(group);
                          }}
                          className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                          title="Guruhni tahrirlash"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingGroup(group);
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                          title="Guruhni o'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mt-2">
                      {group.name} Guruhi
                    </h4>
                    {group.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                        {group.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                      <Users className="w-4 h-4 text-indigo-500" />
                      {groupStudentsCount} nafar o'quvchi
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      O'quvchilar ro'yxati →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ========================================================
            VIEW 2: ALOHIDA GURUH SAHIFASI (O'quvchilar Ro'yxati)
           ======================================================== */
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top Bar with Back Button */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedGroupId(null);
                  setSearchQuery('');
                }}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Guruhlar ro'yxatiga qaytish"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Guruhlarga qaytish</span>
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-lg text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg">
                    {currentGroup?.name}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ({currentGroupStudents.length} ta o'quvchi)
                  </span>
                  {currentGroup && (
                    <button
                      type="button"
                      onClick={() => openEditGroupModal(currentGroup)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer transition-colors"
                      title="Guruh ma'lumotlarini tahrirlash"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {currentGroup?.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {currentGroup.description}
                  </p>
                )}
              </div>
            </div>

            {/* Actions for this group */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setJsonText('');
                  setJsonError(null);
                  setJsonSuccess(null);
                  setIsJsonModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="JSON fayldan barcha o'quvchilarni ommaviy yuklash"
              >
                <FileCode className="w-4 h-4 text-indigo-500" />
                <span>JSON Ommaviy Yuklash</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setStudentFullName('');
                  setCustomPassword('');
                  setIsStudentModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ O'quvchi Qo'shish</span>
              </button>
            </div>
          </div>

          {/* Search bar inside group */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="O'quvchi ismi yoki EDU- ID bo'yicha qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
            {currentGroupStudents.length === 0 ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 space-y-3">
                <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                  Ushbu guruhda hali o'quvchilar mavjud emas
                </h4>
                <p className="text-xs max-w-sm mx-auto">
                  O'quvchilarni birma-bir qo'shish yoki ko'p sonli o'quvchilarni JSON fayl orqali bir soniyada yuklash mumkin.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setStudentFullName('');
                      setCustomPassword('');
                      setIsStudentModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    + Bittalik qo'shish
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setJsonText('');
                      setJsonError(null);
                      setJsonSuccess(null);
                      setIsJsonModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors"
                  >
                    JSON orqali yuklash
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">T/r</th>
                      <th className="py-3 px-4">Ism va Familiya</th>
                      <th className="py-3 px-4">Talaba ID (Avtomatik)</th>
                      <th className="py-3 px-4">Kirish Paroli (Guruh/Ismdan)</th>
                      <th className="py-3 px-4 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredStudents.map((st, index) => (
                      <tr
                        key={st.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                              {st.fullName.charAt(0)}
                            </div>
                            <span>{st.fullName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            {st.studentId}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 font-mono">
                            <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <button
                              type="button"
                              onClick={() => setVisiblePasswords((v) => ({ ...v, [st.id]: !v[st.id] }))}
                              className="inline-flex items-center gap-1.5 cursor-pointer hover:text-amber-950 dark:hover:text-amber-200"
                              aria-label="Parolni ko‘rsatish/yashirish"
                              title={visiblePasswords[st.id] ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                            >
                              <span>{visiblePasswords[st.id] ? st.password : '••••••••'}</span>
                              {visiblePasswords[st.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActionError(null);
                                setEditingStudent(st);
                                setNewPasswordValue(st.password || '');
                              }}
                              className="ml-1 p-0.5 rounded hover:bg-amber-200/60 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-400 cursor-pointer"
                              title="Parolni tahrirlash"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditStudentModal(st)}
                              className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                              title="O'quvchi ma'lumotlarini tahrirlash"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingStudent(st)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                              title="O'quvchini chiqarish"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 1: YANGI GURUH YARATISH (masalan: 01-26, 02-26, KTD04-26)
         ======================================================== */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              {editingGroup ? 'Guruh Ma’lumotlarini Tahrirlash' : 'Yangi Guruh Yaratish'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Guruh nomi formati: <strong>01-26</strong>, <strong>02-26</strong>, <strong>KTD04-26</strong> va h.k.
            </p>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Guruh Nomi *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSavingGroup}
                  placeholder="masalan: 01-26 yoki KTD04-26"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Guruh Tavsifi / Yo'nalishi (ixtiyoriy)
                </label>
                <textarea
                  rows={2}
                  disabled={isSavingGroup}
                  placeholder="masalan: Dasturlash va axborot texnologiyalari..."
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSavingGroup}
                  onClick={() => {
                    setIsGroupModalOpen(false);
                    setEditingGroup(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSavingGroup}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSavingGroup && <InlineSpinner className="w-3.5 h-3.5" />}
                  <span>
                    {isSavingGroup
                      ? 'Saqlanmoqda...'
                      : editingGroup
                      ? "O'zgarishlarni Saqlash"
                      : 'Guruhni Saqlash'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: BITTALIK O'QUVCHI QO'SHISH (Email field olib tashlangan!)
         ======================================================== */}
      {isStudentModalOpen && currentGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Guruhga O'quvchi Qo'shish
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Guruh: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{currentGroup.name}</strong>. Talaba ID va Parol avtomatik generatsiya qilinadi.
            </p>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  O'quvchining Ism va Familiyasi *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSavingStudent}
                  placeholder="masalan: Anvar Qodirov"
                  value={studentFullName}
                  onChange={(e) => setStudentFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              {/* Real-time Generated ID & Password Preview */}
              {studentFullName.trim() && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Avtomatik Generatsiya Qilinadigan Ma'lumotlar:
                  </div>

                  {(() => {
                    const { studentId, autoPassword } = generateStudentCredentials(
                      currentGroup.name,
                      studentFullName,
                      getNextSequenceIndex()
                    );
                    return (
                      <div className="space-y-1.5 font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Talaba ID:</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {studentId}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Boshlang'ich Parol:</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {customPassword.trim() || autoPassword}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Boshqa maxsus parol berish (ixtiyoriy)
                </label>
                <input
                  type="text"
                  disabled={isSavingStudent}
                  placeholder="Bo'sh qoldirilsa, avtomatik parol o'rnatiladi"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              {isSavingStudent && (
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-2">
                  <InlineSpinner className="w-4 h-4" />
                  <span>O'quvchi ma'lumotlari bazaga saqlanmoqda...</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSavingStudent}
                  onClick={() => setIsStudentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent || !studentFullName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSavingStudent && <InlineSpinner className="w-3.5 h-3.5" />}
                  <span>{isSavingStudent ? "Qo'shilmoqda..." : "O'quvchini Saqlash"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: JSON ORQALI OMMAVIY YUKLASH (BULK IMPORT & EXAMPLE)
         ======================================================== */}
      {isJsonModalOpen && currentGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full">
                  Ommaviy Ro'yxatga Olish (Bulk JSON Upload)
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  O'quvchilarni JSON Fayl Orqali Yuklash
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tanlangan guruh: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{currentGroup.name}</strong>
                </p>
              </div>

              <button
                type="button"
                disabled={isUploadingJson}
                onClick={() => setIsJsonModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Status alerts */}
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

            {/* Example Section */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mb-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    JSON Strukturasi Qanday Bo'lishi Kerak? (Namuna)
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
                    onClick={handleDownloadSampleJson}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer hover:bg-indigo-100"
                  >
                    <Download className="w-3 h-3" />
                    <span>Namunani yuklab olish</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl overflow-x-auto text-emerald-400 font-mono text-xs">
                <pre>{sampleJsonExample}</pre>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                💡 <strong>Eslatma:</strong> Har bir o'quvchi uchun faqat <code className="text-indigo-600 dark:text-indigo-400 font-bold">"fullName"</code> maydoni kiritilishi kifoya! Tizim avtomatik tarzda har bir o'quvchiga guruh nomidan kelib chiqib <code className="font-mono">EDU-{currentGroup.name.replace(/[^a-zA-Z0-9]/g, '')}-00X</code> ID va maxfiy parol generatsiya qilib beradi.
              </p>
            </div>

            {/* Input & Upload area */}
            <form onSubmit={handleProcessJsonImport} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    JSON Fayl Yuklash yoki Matnni Kiriting:
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingJson}
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Kompyuterdan .json faylni tanlash
                  </button>
                </div>

                <textarea
                  rows={6}
                  disabled={isUploadingJson}
                  placeholder={`[\n  { "fullName": "Anvar Qodirov" },\n  { "fullName": "Dilshod Aliyev" }\n]`}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  className="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              {isUploadingJson && (
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-2">
                  <InlineSpinner className="w-4 h-4" />
                  <span>O'quvchilar ro'yxati bazaga yuklanmoqda...</span>
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
                  {isUploadingJson ? <InlineSpinner /> : <Upload className="w-4 h-4" />}
                  <span>{isUploadingJson ? "Yuklanmoqda..." : "O'quvchilarni Tizimga Qo'shish"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4b: O'QUVCHI MA'LUMOTLARINI TAHRIRLASH (Ism, ID, Guruh, Parol)
         ======================================================== */}
      {editingStudentProfile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-indigo-500" />
              O'quvchi Ma'lumotlarini Tahrirlash
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              O'quvchining ism-familiyasi, Talaba ID, guruhi va kirish parolini o'zgartirishingiz mumkin.
            </p>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStudentProfile} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ism va Familiya *
                </label>
                <input
                  type="text"
                  required
                  disabled={isUpdatingStudent}
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Talaba ID *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isUpdatingStudent}
                    value={editStudentId}
                    onChange={(e) => setEditStudentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Guruh
                  </label>
                  <select
                    disabled={isUpdatingStudent}
                    value={editStudentGroupId}
                    onChange={(e) => setEditStudentGroupId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kirish Paroli *
                </label>
                <input
                  type="text"
                  required
                  disabled={isUpdatingStudent}
                  value={editStudentPassword}
                  onChange={(e) => setEditStudentPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isUpdatingStudent}
                  onClick={() => setEditingStudentProfile(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStudent || !editStudentName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isUpdatingStudent ? <InlineSpinner className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isUpdatingStudent ? 'Saqlanmoqda...' : "O'zgarishlarni Saqlash"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: PAROLNI O'ZGARTIRISH (Edit Password)
         ======================================================== */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              Parolni O'zgartirish
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              <strong>{editingStudent.fullName}</strong> ({editingStudent.studentId}) uchun yangi kirish parolini kiriting.
            </p>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditedPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Yangi Parol *
                </label>
                <input
                  type="text"
                  required
                  disabled={isUpdatingPassword}
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isUpdatingPassword}
                  onClick={() => setEditingStudent(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 cursor-pointer disabled:opacity-60"
                >
                  {isUpdatingPassword ? <InlineSpinner className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isUpdatingPassword ? 'Saqlanmoqda...' : 'Saqlash'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 5: O'QUVCHINI O'CHIRISH TASDIG'I (Single confirmation)
         ======================================================== */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              O'quvchini o'chirish
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
              Haqiqatan ham <strong>{deletingStudent.fullName}</strong> ({deletingStudent.studentId}) ismli o'quvchini guruhdan va MongoDB bazasidan o'chirishni xohlaysizmi?
            </p>
            {actionError && (
              <p className="text-xs text-rose-600 mb-3">{actionError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeletingStudent(null);
                  setActionError(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleConfirmDeleteStudent()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {isDeleting && <InlineSpinner className="w-3.5 h-3.5" />}
                <span>{isDeleting ? "O'chirilmoqda..." : "Ha, O'chirish"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 6: GURUHNI O'CHIRISH TASDIG'I (Single confirmation)
         ======================================================== */}
      {deletingGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              Guruhni o'chirish
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
              Haqiqatan ham <strong>{deletingGroup.name}</strong> guruhini va undagi barcha o'quvchilarni o'chirishni xohlaysizmi?
            </p>
            {actionError && (
              <p className="text-xs text-rose-600 mb-3">{actionError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeletingGroup(null);
                  setActionError(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleConfirmDeleteGroup()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
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
