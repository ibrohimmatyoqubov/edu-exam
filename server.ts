/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import connectToDatabase from './src/lib/mongodb';
import { seedDatabaseIfEmpty } from './src/lib/seedDatabase';
import {
  UserModel,
  GroupModel,
  SubjectModel,
  ExamModel,
  QuestionModel,
  ExamSessionModel,
} from './src/models';
import {
  initialUsers,
  initialGroups,
  initialSubjects,
  initialExams,
  initialQuestions,
  initialExamSessions,
} from './src/data/initialData';
import type { User, Group, Subject, Exam, Question, ExamSession } from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type StoredQuestion = Question & { variant?: number };

interface PersistentStoreData {
  seeded: boolean;
  users: User[];
  groups: Group[];
  subjects: Subject[];
  exams: Exam[];
  questions: StoredQuestion[];
  sessions: ExamSession[];
}

const DATA_DIR = path.join(__dirname, '.data');
const DATA_FILE = path.join(DATA_DIR, 'eduexam-db.json');

function loadPersistentStore(): PersistentStoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistentStoreData>;
      if (parsed && parsed.seeded) {
        return {
          seeded: true,
          users: Array.isArray(parsed.users) ? parsed.users : [],
          groups: Array.isArray(parsed.groups) ? parsed.groups : [],
          subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
          exams: Array.isArray(parsed.exams) ? parsed.exams : [],
          questions: Array.isArray(parsed.questions) ? parsed.questions : [],
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        };
      }
    }
  } catch (err) {
    console.warn('Mahalliy saqlangan bazani o‘qishda xatolik:', err);
  }

  const initialStore: PersistentStoreData = {
    seeded: true,
    users: structuredClone(initialUsers),
    groups: structuredClone(initialGroups),
    subjects: structuredClone(initialSubjects),
    exams: structuredClone(initialExams),
    questions: structuredClone(initialQuestions),
    sessions: structuredClone(initialExamSessions),
  };
  savePersistentStore(initialStore);
  return initialStore;
}

function savePersistentStore(store: PersistentStoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DATA_FILE);
  } catch (err) {
    console.error('Mahalliy bazani diskka saqlashda xatolik:', err);
  }
}

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '5mb' }));

  // Connect & Seed MongoDB when MONGODB_URI is configured and reachable; otherwise use disk-backed persistent store
  let isDbConnected = false;
  try {
    await connectToDatabase();
    isDbConnected = true;
    await seedDatabaseIfEmpty();
  } catch (err) {
    console.warn(
      'MongoDB not connected — running with persistent local file store:',
      err instanceof Error ? err.message : err
    );
  }

  // Disk-backed persistent store (loaded once; never overwritten by initialData once created)
  const memoryStore: PersistentStoreData = loadPersistentStore();

  // Auto-persist every mutating API call when using the local persistent store
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (
      !isDbConnected &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      !req.path.startsWith('/auth/') &&
      req.path !== '/sessions/grade'
    ) {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          savePersistentStore(memoryStore);
        }
      });
    }
    next();
  });

  // ==================== SYSTEM STATUS ====================
  app.get('/api/health', async (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      database: isDbConnected ? 'MongoDB' : 'In-Memory Fallback',
      connected: isDbConnected,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/mongodb/status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isDbConnected) {
        return res.json({
          success: true,
          cluster: 'in-memory-fallback',
          database: 'eduexam_secure',
          username: process.env.MONGODB_USERNAME || 'local',
          connected: false,
          pooling: 'in-memory',
          counts: {
            users: memoryStore.users.length,
            groups: memoryStore.groups.length,
            subjects: memoryStore.subjects.length,
            exams: memoryStore.exams.length,
            questions: memoryStore.questions.length,
            sessions: memoryStore.sessions.length,
          },
        });
      }

      const counts = {
        users: await UserModel.countDocuments(),
        groups: await GroupModel.countDocuments(),
        subjects: await SubjectModel.countDocuments(),
        exams: await ExamModel.countDocuments(),
        questions: await QuestionModel.countDocuments(),
        sessions: await ExamSessionModel.countDocuments(),
      };
      res.json({
        success: true,
        cluster: 'mongodb',
        database: 'eduexam_secure',
        username: process.env.MONGODB_USERNAME || 'configured',
        connected: isDbConnected,
        pooling: 'maxPoolSize=50',
        counts,
      });
    } catch (err) {
      next(err);
    }
  });

  // ==================== AUTH API ====================
  app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, email, studentId, password } = req.body;
      const identifier = String(email ?? '').trim().toLowerCase();
      const rawPassword = String(password ?? '');
      const trimmedPassword = rawPassword.trim();

      const matchesAdminIdentifier = (u: { email?: unknown; fullName?: unknown }) => {
        const uEmail = u.email ? String(u.email).trim().toLowerCase() : '';
        const uName = u.fullName ? String(u.fullName).trim().toLowerCase() : '';
        return Boolean(identifier) && (uEmail === identifier || uName === identifier);
      };

      const matchesPassword = (storedPassword: unknown) => {
        const stored = String(storedPassword ?? '');
        return stored === rawPassword || stored.trim() === trimmedPassword;
      };

      if (!isDbConnected) {
        if (role === 'ADMIN') {
          const admin = memoryStore.users.find(
            (u) =>
              String(u.role || '').toUpperCase() === 'ADMIN' &&
              matchesAdminIdentifier(u) &&
              matchesPassword(u.password)
          );
          if (!admin) {
            return res.status(401).json({ success: false, error: "Email/ism yoki parol noto'g'ri!" });
          }
          return res.json({ success: true, user: { ...admin, role: 'ADMIN' } });
        } else {
          const student = memoryStore.users.find(
            (u) => u.role === 'STUDENT' && (u.id === studentId || u.studentId === studentId)
          );
          if (!student || !matchesPassword(student.password)) {
            return res.status(401).json({ success: false, error: "Parol noto'g'ri!" });
          }
          return res.json({ success: true, user: student });
        }
      }

      if (role === 'ADMIN') {
        const admins = await UserModel.find({ role: { $regex: /^admin$/i } }).lean();
        const admin = admins.find(
          (u) => matchesAdminIdentifier(u) && matchesPassword(u.password)
        );
        if (!admin) {
          return res.status(401).json({ success: false, error: "Email/ism yoki parol noto'g'ri!" });
        }
        return res.json({
          success: true,
          user: { ...admin, id: String(admin._id), role: 'ADMIN' },
        });
      } else {
        const student = await UserModel.findOne({
          _id: studentId,
          role: 'STUDENT',
        });
        if (!student || !matchesPassword(student.password)) {
          return res.status(401).json({ success: false, error: "Parol noto'g'ri!" });
        }
        return res.json({ success: true, user: student });
      }
    } catch (err) {
      next(err);
    }
  });

  // ==================== GROUPS API ====================
  app.get('/api/groups', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isDbConnected) {
        const sorted = [...memoryStore.groups].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return res.json(sorted);
      }
      const groups = await GroupModel.find().sort({ createdAt: -1 });
      res.json(groups);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/groups', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description } = req.body;
      if (!isDbConnected) {
        const newGroup: Group = {
          id: makeId('grp'),
          name: name.trim(),
          description: description?.trim(),
          studentCount: 0,
          createdAt: new Date().toISOString(),
        };
        memoryStore.groups.unshift(newGroup);
        return res.status(201).json(newGroup);
      }
      const newGroup = await GroupModel.create({
        name: name.trim(),
        description: description?.trim(),
        studentCount: 0,
      });
      res.status(201).json(newGroup);
    } catch (err: any) {
      if (err?.name === 'MongooseError' || err?.name === 'MongoNetworkError') return next(err);
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/groups/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body as { name?: string; description?: string };
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName) {
        return res.status(400).json({ error: 'Guruh nomi kiritilishi shart!' });
      }
      const cleanDesc = typeof description === 'string' ? description.trim() : undefined;

      if (!isDbConnected) {
        const group = memoryStore.groups.find((g) => g.id === id);
        if (!group) return res.status(404).json({ error: 'Guruh topilmadi' });
        group.name = cleanName;
        if (description !== undefined) group.description = cleanDesc || undefined;
        memoryStore.users.forEach((u) => {
          if (u.groupId === id) u.groupName = cleanName;
        });
        memoryStore.sessions.forEach((s) => {
          if (s.groupId === id) s.groupName = cleanName;
        });
        return res.json(group);
      }

      const updateFields: Record<string, unknown> = { name: cleanName };
      if (description !== undefined) updateFields.description = cleanDesc || '';
      const updated = await GroupModel.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true }
      );
      if (!updated) return res.status(404).json({ error: 'Guruh topilmadi' });

      await Promise.all([
        UserModel.updateMany({ groupId: id }, { $set: { groupName: cleanName } }),
        ExamSessionModel.updateMany({ groupId: id }, { $set: { groupName: cleanName } }),
      ]);
      res.json(updated);
    } catch (err: any) {
      if (err?.name === 'MongooseError' || err?.name === 'MongoNetworkError') return next(err);
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/groups/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!isDbConnected) {
        memoryStore.groups = memoryStore.groups.filter((g) => g.id !== id);
        memoryStore.users = memoryStore.users.filter((u) => u.groupId !== id);
        return res.json({ success: true });
      }
      await GroupModel.findByIdAndDelete(id);
      await UserModel.deleteMany({ groupId: id });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/subjects', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isDbConnected) {
        const sorted = [...memoryStore.subjects].sort((a, b) => a.name.localeCompare(b.name));
        return res.json(sorted);
      }
      res.json(await SubjectModel.find().sort({ name: 1 }));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/subjects', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isDbConnected) {
        const subj: Subject = {
          ...req.body,
          id: req.body.id || makeId('sbj'),
          createdAt: req.body.createdAt || new Date().toISOString(),
        };
        memoryStore.subjects.push(subj);
        return res.status(201).json(subj);
      }
      res.status(201).json(await SubjectModel.create(req.body));
    } catch (err: any) {
      if (err?.name === 'MongooseError' || err?.name === 'MongoNetworkError') return next(err);
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/subjects/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, code } = req.body as {
        name?: string;
        code?: string;
      };
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName) {
        return res.status(400).json({ error: 'Fan nomi kiritilishi shart!' });
      }
      const cleanCode = typeof code === 'string' ? code.trim() : undefined;

      if (!isDbConnected) {
        const subject = memoryStore.subjects.find((s) => s.id === id);
        if (!subject) return res.status(404).json({ error: 'Fan topilmadi' });
        subject.name = cleanName;
        if (cleanCode) subject.code = cleanCode;

        const subjectExamIds = memoryStore.exams
          .filter((e) => e.subjectId === id)
          .map((e) => {
            e.subjectName = cleanName;
            return e.id;
          });
        memoryStore.sessions.forEach((s) => {
          if (subjectExamIds.includes(s.examId)) {
            s.subjectName = cleanName;
          }
        });
        return res.json(subject);
      }

      const updateFields: Record<string, unknown> = { name: cleanName };
      if (cleanCode) updateFields.code = cleanCode;

      const updated = await SubjectModel.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true }
      );
      if (!updated) return res.status(404).json({ error: 'Fan topilmadi' });

      const subjectExams = await ExamModel.find({ subjectId: id }).select('_id');
      const examIds = subjectExams.map((e) => String(e._id));
      await ExamModel.updateMany({ subjectId: id }, { $set: { subjectName: cleanName } });
      if (examIds.length > 0) {
        await ExamSessionModel.updateMany(
          { examId: { $in: examIds } },
          { $set: { subjectName: cleanName } }
        );
      }
      res.json(updated);
    } catch (err: any) {
      if (err?.name === 'MongooseError' || err?.name === 'MongoNetworkError') return next(err);
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/subjects/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!isDbConnected) {
        const deletedExamIds = memoryStore.exams
          .filter((e) => e.subjectId === id)
          .map((e) => e.id);
        memoryStore.subjects = memoryStore.subjects.filter((s) => s.id !== id);
        memoryStore.exams = memoryStore.exams.filter((e) => e.subjectId !== id);
        memoryStore.questions = memoryStore.questions.filter((q) => !deletedExamIds.includes(q.examId));
        memoryStore.sessions = memoryStore.sessions.filter((s) => !deletedExamIds.includes(s.examId));
        return res.json({ success: true });
      }
      const subjectExams = await ExamModel.find({ subjectId: id }).select('_id');
      const examIds = subjectExams.map((e) => e._id);
      if (examIds.length > 0) {
        await QuestionModel.deleteMany({ examId: { $in: examIds } });
        await ExamSessionModel.deleteMany({ examId: { $in: examIds } });
        await ExamModel.deleteMany({ subjectId: id });
      }
      await SubjectModel.findByIdAndDelete(id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ==================== STUDENTS API ====================
  app.get('/api/students', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { groupId } = req.query;
      if (!isDbConnected) {
        let students = memoryStore.users.filter((u) => u.role === 'STUDENT');
        if (groupId) students = students.filter((u) => u.groupId === groupId);
        students.sort((a, b) => a.fullName.localeCompare(b.fullName));
        return res.json(students);
      }
      const filter: any = { role: 'STUDENT' };
      if (groupId) filter.groupId = groupId;
      const students = await UserModel.find(filter).sort({ fullName: 1 });
      res.json(students);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/students', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fullName, studentId, password, groupId, groupName } = req.body;
      if (!isDbConnected) {
        const newStudent: User = {
          id: makeId('usr-stu'),
          fullName: fullName.trim(),
          studentId,
          password,
          role: 'STUDENT',
          groupId,
          groupName,
          createdAt: new Date().toISOString(),
        };
        memoryStore.users.push(newStudent);
        const grp = memoryStore.groups.find((g) => g.id === groupId);
        if (grp) grp.studentCount = (grp.studentCount || 0) + 1;
        return res.status(201).json(newStudent);
      }

      const newStudent = await UserModel.create({
        fullName: fullName.trim(),
        studentId,
        password,
        role: 'STUDENT',
        groupId,
        groupName,
      });

      await GroupModel.findByIdAndUpdate(groupId, { $inc: { studentCount: 1 } });
      res.status(201).json(newStudent);
    } catch (err: any) {
      if (err?.name === 'MongooseError' || err?.name === 'MongoNetworkError') return next(err);
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/students/bulk', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { students, groupId } = req.body;
      if (!Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ error: "Ro'yxat bo'sh!" });
      }

      if (!isDbConnected) {
        const created: User[] = students.map((s: User) => ({
          ...s,
          id: s.id || makeId('usr-stu'),
          role: 'STUDENT',
          createdAt: s.createdAt || new Date().toISOString(),
        }));
        memoryStore.users.push(...created);
        const grp = memoryStore.groups.find((g) => g.id === groupId);
        if (grp) grp.studentCount = (grp.studentCount || 0) + created.length;
        return res.json({ success: true, count: created.length });
      }

      const inserted = await UserModel.insertMany(students);
      await GroupModel.findByIdAndUpdate(groupId, {
        $inc: { studentCount: inserted.length },
      });
      res.json({ success: true, count: inserted.length });
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/students/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { fullName, studentId, password, groupId, groupName } = req.body as {
        fullName?: string;
        studentId?: string;
        password?: string;
        groupId?: string;
        groupName?: string;
      };
      const cleanName = typeof fullName === 'string' ? fullName.trim() : '';
      if (!cleanName) {
        return res.status(400).json({ error: "O'quvchining ism va familiyasi kiritilishi shart!" });
      }
      const cleanStudentId = typeof studentId === 'string' ? studentId.trim() : undefined;
      const cleanPassword = typeof password === 'string' ? password.trim() : undefined;

      if (!isDbConnected) {
        const student = memoryStore.users.find((u) => u.id === id);
        if (!student) return res.status(404).json({ error: "O'quvchi topilmadi" });

        const prevGroupId = student.groupId;
        const prevStudentId = student.studentId || student.id;
        let resolvedGroupId = prevGroupId;
        let resolvedGroupName = student.groupName;

        if (groupId && groupId !== prevGroupId) {
          const newGroup = memoryStore.groups.find((g) => g.id === groupId);
          if (newGroup) {
            resolvedGroupId = newGroup.id;
            resolvedGroupName = newGroup.name;
            if (prevGroupId) {
              const oldGroup = memoryStore.groups.find((g) => g.id === prevGroupId);
              if (oldGroup && oldGroup.studentCount > 0) oldGroup.studentCount -= 1;
            }
            newGroup.studentCount = (newGroup.studentCount || 0) + 1;
          }
        } else if (groupName) {
          resolvedGroupName = groupName;
        }

        student.fullName = cleanName;
        if (cleanStudentId) student.studentId = cleanStudentId;
        if (cleanPassword) student.password = cleanPassword;
        student.groupId = resolvedGroupId;
        student.groupName = resolvedGroupName;

        memoryStore.sessions.forEach((s) => {
          if (s.studentId === prevStudentId || s.studentId === student.id) {
            s.studentName = cleanName;
            if (cleanStudentId) s.studentId = cleanStudentId;
            if (resolvedGroupId) s.groupId = resolvedGroupId;
            if (resolvedGroupName) s.groupName = resolvedGroupName;
          }
        });

        return res.json(student);
      }

      const existing = await UserModel.findById(id);
      if (!existing) return res.status(404).json({ error: "O'quvchi topilmadi" });

      const prevGroupId = existing.groupId;
      const prevStudentId = existing.studentId || String(existing._id);
      const patch: Record<string, unknown> = { fullName: cleanName };
      if (cleanStudentId) patch.studentId = cleanStudentId;
      if (cleanPassword) patch.password = cleanPassword;

      let resolvedGroupId = prevGroupId;
      let resolvedGroupName = existing.groupName;
      if (groupId && groupId !== prevGroupId) {
        const targetGroup = await GroupModel.findById(groupId);
        if (targetGroup) {
          resolvedGroupId = String(targetGroup._id);
          resolvedGroupName = targetGroup.name;
          patch.groupId = resolvedGroupId;
          patch.groupName = resolvedGroupName;
          if (prevGroupId) {
            await GroupModel.findByIdAndUpdate(prevGroupId, { $inc: { studentCount: -1 } });
          }
          await GroupModel.findByIdAndUpdate(resolvedGroupId, { $inc: { studentCount: 1 } });
        }
      } else if (groupName) {
        resolvedGroupName = groupName;
        patch.groupName = groupName;
      }

      const updated = await UserModel.findByIdAndUpdate(id, { $set: patch }, { new: true });
      const sessionPatch: Record<string, unknown> = { studentName: cleanName };
      if (cleanStudentId) sessionPatch.studentId = cleanStudentId;
      if (resolvedGroupId) sessionPatch.groupId = resolvedGroupId;
      if (resolvedGroupName) sessionPatch.groupName = resolvedGroupName;
      await ExamSessionModel.updateMany(
        { studentId: { $in: [prevStudentId, String(existing._id)] } },
        { $set: sessionPatch }
      );

      res.json(updated);
    } catch (err: any) {
      if (err?.name === 'MongooseError' || err?.name === 'MongoNetworkError') return next(err);
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/students/:id/password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      if (!isDbConnected) {
        const student = memoryStore.users.find((u) => u.id === id);
        if (student) student.password = password;
        return res.json({ success: true, user: student || null });
      }
      const updated = await UserModel.findByIdAndUpdate(
        id,
        { $set: { password } },
        { new: true }
      );
      res.json({ success: true, user: updated });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/students/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!isDbConnected) {
        const student = memoryStore.users.find((u) => u.id === id);
        memoryStore.users = memoryStore.users.filter((u) => u.id !== id);
        if (student?.groupId) {
          const grp = memoryStore.groups.find((g) => g.id === student.groupId);
          if (grp && grp.studentCount > 0) grp.studentCount -= 1;
        }
        return res.json({ success: true });
      }
      const student = await UserModel.findByIdAndDelete(id);
      if (student && student.groupId) {
        await GroupModel.findByIdAndUpdate(student.groupId, {
          $inc: { studentCount: -1 },
        });
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ==================== EXAMS API ====================
  app.get('/api/exams', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isDbConnected) {
        const sorted = [...memoryStore.exams].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return res.json(sorted);
      }
      const exams = await ExamModel.find().sort({ createdAt: -1 });
      res.json(exams);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/exams', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isDbConnected) {
        const newExam: Exam = {
          ...req.body,
          id: req.body.id || makeId('ex'),
          createdAt: req.body.createdAt || new Date().toISOString(),
        };
        memoryStore.exams.unshift(newExam);
        return res.status(201).json(newExam);
      }
      const newExam = await ExamModel.create(req.body);
      res.status(201).json(newExam);
    } catch (err: any) {
      if (err?.name === 'MongooseError' || err?.name === 'MongoNetworkError') return next(err);
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/exams/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { groupIds, durationMinutes, passingScore, maxAttempts, title, type, subjectId, isActive } =
        req.body;
      const patch: Record<string, unknown> = {};
      if (Array.isArray(groupIds)) patch.groupIds = groupIds;
      if (typeof durationMinutes === 'number' && durationMinutes > 0) patch.durationMinutes = durationMinutes;
      if (typeof passingScore === 'number') patch.passingScore = passingScore;
      if (typeof maxAttempts === 'number') patch.maxAttempts = maxAttempts;
      if (typeof title === 'string' && title.trim()) patch.title = title.trim();
      if (typeof type === 'string') patch.type = type;
      if (typeof isActive === 'boolean') {
        patch.isActive = isActive;
        if (isActive) patch.startedAt = new Date().toISOString();
        else patch.stoppedAt = new Date().toISOString();
      }

      if (!isDbConnected) {
        const exam = memoryStore.exams.find((e) => e.id === id);
        if (!exam) return res.status(404).json({ error: 'Topilmadi' });
        if (typeof subjectId === 'string' && subjectId) {
          const subj = memoryStore.subjects.find((s) => s.id === subjectId);
          if (subj) {
            patch.subjectId = subj.id;
            patch.subjectName = subj.name;
          }
        }
        Object.assign(exam, patch);
        if (patch.title || patch.subjectName) {
          memoryStore.sessions.forEach((s) => {
            if (s.examId === id) {
              if (typeof patch.title === 'string') s.examTitle = patch.title;
              if (typeof patch.subjectName === 'string') s.subjectName = patch.subjectName;
            }
          });
        }
        return res.json(exam);
      }

      if (typeof subjectId === 'string' && subjectId) {
        const subj = await SubjectModel.findById(subjectId);
        if (subj) {
          patch.subjectId = subj._id;
          patch.subjectName = subj.name;
        }
      }

      const updated = await ExamModel.findByIdAndUpdate(id, { $set: patch }, { new: true });
      if (!updated) return res.status(404).json({ error: 'Topilmadi' });

      if (patch.title || patch.subjectName) {
        const sessionPatch: Record<string, unknown> = {};
        if (patch.title) sessionPatch.examTitle = patch.title;
        if (patch.subjectName) sessionPatch.subjectName = patch.subjectName;
        await ExamSessionModel.updateMany({ examId: id }, { $set: sessionPatch });
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/exams/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { groupIds, durationMinutes, isActive } = (req.body || {}) as {
        groupIds?: string[];
        durationMinutes?: number;
        isActive?: boolean;
      };

      if (!isDbConnected) {
        const exam = memoryStore.exams.find((e) => e.id === id);
        if (!exam) return res.status(404).json({ error: 'Topilmadi' });
        if (Array.isArray(groupIds)) exam.groupIds = groupIds;
        if (typeof durationMinutes === 'number' && durationMinutes > 0) {
          exam.durationMinutes = durationMinutes;
        }
        exam.isActive = typeof isActive === 'boolean' ? isActive : !exam.isActive;
        if (exam.isActive) {
          exam.startedAt = new Date().toISOString();
          exam.stoppedAt = undefined;
        } else {
          exam.stoppedAt = new Date().toISOString();
        }
        return res.json(exam);
      }

      const exam = await ExamModel.findById(id);
      if (!exam) return res.status(404).json({ error: 'Topilmadi' });

      if (Array.isArray(groupIds)) exam.groupIds = groupIds;
      if (typeof durationMinutes === 'number' && durationMinutes > 0) {
        exam.durationMinutes = durationMinutes;
      }
      exam.isActive = typeof isActive === 'boolean' ? isActive : !exam.isActive;
      if (exam.isActive) {
        exam.startedAt = new Date();
        exam.stoppedAt = undefined;
      } else {
        exam.stoppedAt = new Date();
      }
      await exam.save();
      res.json(exam);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/exams/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isDbConnected) {
        memoryStore.exams = memoryStore.exams.filter((e) => e.id !== req.params.id);
        memoryStore.questions = memoryStore.questions.filter((q) => q.examId !== req.params.id);
        memoryStore.sessions = memoryStore.sessions.filter((s) => s.examId !== req.params.id);
        return res.json({ success: true });
      }
      await ExamModel.findByIdAndDelete(req.params.id);
      await QuestionModel.deleteMany({ examId: req.params.id });
      await ExamSessionModel.deleteMany({ examId: req.params.id });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ==================== QUESTIONS API ====================
  app.get('/api/questions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { examId, studentMode } = req.query;

      if (!isDbConnected) {
        let list = examId
          ? memoryStore.questions.filter((q) => q.examId === String(examId))
          : [...memoryStore.questions];

        if (studentMode === 'true' && examId) {
          const variants = Array.from(
            new Set(list.map((q) => q.variant).filter((v): v is number => v !== undefined))
          );
          if (variants.length > 1) {
            const chosen = variants[Math.floor(Math.random() * variants.length)];
            list = list.filter((q) => q.variant === chosen);
          }
          return res.json(list.map(({ correctOptionId: _omit, ...rest }) => rest));
        }

        return res.json(list);
      }

      const query: any = {};
      if (examId) query.examId = examId;

      if (studentMode === 'true' && examId) {
        const variants = await QuestionModel.find({ examId: String(examId) }).distinct('variant').exec();
        if (variants.length > 1) query.variant = variants[Math.floor(Math.random() * variants.length)];
      }

      const questions =
        studentMode === 'true'
          ? await QuestionModel.find(query).select('-correctOptionId').exec()
          : await QuestionModel.find(query).exec();
      res.json(questions);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/questions/bulk', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { examId, variants } = req.body as {
        examId?: string;
        variants?: Array<{ questions: Array<{ text: string; options: string[]; correctAnswer: number }> }>;
      };
      if (
        !examId ||
        !Array.isArray(variants) ||
        variants.length !== 5 ||
        variants.some((v) => !Array.isArray(v.questions) || v.questions.length !== 20)
      ) {
        return res
          .status(400)
          .json({ error: 'JSON beshta variantdan iborat bo‘lishi va har birida 20 ta savol bo‘lishi kerak.' });
      }

      const docs = variants.flatMap((variant, variantIndex) =>
        variant.questions.map((q, questionIndex) => {
          if (
            typeof q.text !== 'string' ||
            !q.text.trim() ||
            !Array.isArray(q.options) ||
            q.options.length !== 4 ||
            q.options.some((option) => typeof option !== 'string' || !option.trim()) ||
            !Number.isInteger(q.correctAnswer) ||
            q.correctAnswer < 0 ||
            q.correctAnswer > 3
          ) {
            throw new Error(
              `Variant ${variantIndex + 1}, savol ${questionIndex + 1}: matn, 4 ta javob va 0–3 oralig‘ida correctAnswer kerak.`
            );
          }
          return {
            id: makeId(`q-v${variantIndex + 1}-${questionIndex + 1}`),
            examId,
            variant: variantIndex + 1,
            questionText: q.text.trim(),
            options: q.options.map((text, index) => ({ id: `opt-${index + 1}`, text: text.trim() })),
            correctOptionId: `opt-${q.correctAnswer + 1}`,
            points: 1,
          };
        })
      );

      if (!isDbConnected) {
        memoryStore.questions = memoryStore.questions.filter((q) => q.examId !== examId);
        memoryStore.questions.push(...docs);
        const exam = memoryStore.exams.find((e) => e.id === examId);
        if (exam) {
          exam.questionCount = 20;
          exam.totalPoints = 20;
        }
        return res.status(201).json({ success: true, count: docs.length, variants: 5 });
      }

      await QuestionModel.deleteMany({ examId });
      await QuestionModel.insertMany(docs);
      await ExamModel.findByIdAndUpdate(examId, { $set: { questionCount: 20, totalPoints: 20 } });
      res.status(201).json({ success: true, count: docs.length, variants: 5 });
    } catch (err: any) {
      if (err?.name === 'MongooseError' || err?.name === 'MongoNetworkError') return next(err);
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/questions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isDbConnected) {
        const newQ: StoredQuestion = {
          ...req.body,
          id: req.body.id || makeId('q'),
        };
        memoryStore.questions.push(newQ);
        const examQs = memoryStore.questions.filter((q) => q.examId === newQ.examId);
        const exam = memoryStore.exams.find((e) => e.id === newQ.examId);
        if (exam) {
          exam.questionCount = examQs.length;
          exam.totalPoints = examQs.reduce((sum, q) => sum + (q.points || 0), 0);
        }
        return res.status(201).json(newQ);
      }

      const newQ = await QuestionModel.create(req.body);
      const count = await QuestionModel.countDocuments({ examId: req.body.examId });
      const questions = await QuestionModel.find({ examId: req.body.examId });
      const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
      await ExamModel.findByIdAndUpdate(req.body.examId, {
        $set: { questionCount: count, totalPoints },
      });
      res.status(201).json(newQ);
    } catch (err: any) {
      if (err?.name === 'MongooseError' || err?.name === 'MongoNetworkError') return next(err);
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/questions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { questionText, codeSnippet, options, correctOptionId, points, variant, explanation } =
        req.body as {
          questionText?: string;
          codeSnippet?: string;
          options?: Array<{ id: string; text: string }>;
          correctOptionId?: string;
          points?: number;
          variant?: number;
          explanation?: string;
        };

      const cleanText = typeof questionText === 'string' ? questionText.trim() : undefined;
      if (cleanText !== undefined && !cleanText) {
        return res.status(400).json({ error: 'Savol matni bo‘sh bo‘lmasligi kerak.' });
      }

      const cleanOptions = Array.isArray(options)
        ? options
            .map((opt) => ({ id: String(opt.id), text: String(opt.text || '').trim() }))
            .filter((opt) => opt.id && opt.text)
        : undefined;

      if (cleanOptions && cleanOptions.length < 2) {
        return res.status(400).json({ error: 'Kamida 2 ta javob varianti kiritilishi shart!' });
      }

      if (cleanOptions && correctOptionId && !cleanOptions.some((opt) => opt.id === correctOptionId)) {
        return res.status(400).json({ error: "To'g'ri javob varianti bo'sh bo'lmasligi kerak!" });
      }

      const patch: Record<string, unknown> = {};
      if (cleanText !== undefined) patch.questionText = cleanText;
      if (codeSnippet !== undefined) patch.codeSnippet = String(codeSnippet).trim() || undefined;
      if (cleanOptions) patch.options = cleanOptions;
      if (correctOptionId) patch.correctOptionId = correctOptionId;
      if (typeof points === 'number' && points >= 1) patch.points = points;
      if (typeof variant === 'number' && variant >= 1 && variant <= 5) patch.variant = variant;
      if (explanation !== undefined) patch.explanation = String(explanation).trim() || undefined;

      if (!isDbConnected) {
        const question = memoryStore.questions.find((q) => q.id === id);
        if (!question) return res.status(404).json({ error: 'Savol topilmadi' });
        Object.assign(question, patch);
        if (codeSnippet !== undefined && !String(codeSnippet).trim()) delete question.codeSnippet;
        if (explanation !== undefined && !String(explanation).trim()) delete question.explanation;

        const examQs = memoryStore.questions.filter((q) => q.examId === question.examId);
        const exam = memoryStore.exams.find((e) => e.id === question.examId);
        if (exam && exam.questionCount === examQs.length) {
          exam.totalPoints = examQs.reduce((sum, q) => sum + (q.points || 0), 0);
        }
        return res.json(question);
      }

      const updateOps: Record<string, unknown> = { $set: {}, $unset: {} };
      const $set = updateOps.$set as Record<string, unknown>;
      const $unset = updateOps.$unset as Record<string, unknown>;
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) $unset[k] = '';
        else $set[k] = v;
      }
      if (Object.keys($unset).length === 0) delete updateOps.$unset;
      if (Object.keys($set).length === 0) delete updateOps.$set;

      const updated = await QuestionModel.findByIdAndUpdate(id, updateOps, { new: true });
      if (!updated) return res.status(404).json({ error: 'Savol topilmadi' });

      const questions = await QuestionModel.find({ examId: updated.examId });
      const exam = await ExamModel.findById(updated.examId);
      if (exam && exam.questionCount === questions.length) {
        await ExamModel.findByIdAndUpdate(updated.examId, {
          $set: { totalPoints: questions.reduce((sum, q) => sum + (q.points || 0), 0) },
        });
      }
      res.json(updated);
    } catch (err: any) {
      if (err?.name === 'MongooseError' || err?.name === 'MongoNetworkError') return next(err);
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/questions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isDbConnected) {
        const removed = memoryStore.questions.find((q) => q.id === req.params.id);
        memoryStore.questions = memoryStore.questions.filter((q) => q.id !== req.params.id);
        if (removed) {
          const examQs = memoryStore.questions.filter((q) => q.examId === removed.examId);
          const exam = memoryStore.exams.find((e) => e.id === removed.examId);
          if (exam) {
            exam.questionCount = examQs.length;
            exam.totalPoints = examQs.reduce((sum, q) => sum + (q.points || 0), 0);
          }
        }
        return res.json({ success: true });
      }

      const removed = await QuestionModel.findByIdAndDelete(req.params.id);
      if (removed) {
        const questions = await QuestionModel.find({ examId: removed.examId });
        await ExamModel.findByIdAndUpdate(removed.examId, {
          $set: { questionCount: questions.length, totalPoints: questions.reduce((sum, q) => sum + q.points, 0) },
        });
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ==================== SESSIONS & ANTI-CHEAT API ====================
  app.get('/api/sessions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, examId } = req.query;
      if (!isDbConnected) {
        let list = [...memoryStore.sessions];
        if (studentId) list = list.filter((s) => s.studentId === String(studentId));
        if (examId) list = list.filter((s) => s.examId === String(examId));
        list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        return res.json(list);
      }

      const filter: any = {};
      if (studentId) filter.studentId = studentId;
      if (examId) filter.examId = examId;
      const sessions = await ExamSessionModel.find(filter).sort({ createdAt: -1 });
      res.json(sessions);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/sessions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = req.body || {};
      const computedGrade =
        typeof payload.grade === 'number'
          ? payload.grade
          : typeof payload.percentage === 'number'
          ? payload.percentage >= 90
            ? 5
            : payload.percentage >= 70
            ? 4
            : payload.percentage >= 60
            ? 3
            : 2
          : undefined;

      if (!isDbConnected) {
        const existingIdx = memoryStore.sessions.findIndex(
          (s) => s.examId === payload.examId && s.studentId === payload.studentId
        );
        if (existingIdx >= 0) {
          memoryStore.sessions[existingIdx] = {
            ...memoryStore.sessions[existingIdx],
            ...payload,
            id: memoryStore.sessions[existingIdx].id,
            ...(computedGrade !== undefined ? { grade: computedGrade } : {}),
          };
          return res.status(200).json(memoryStore.sessions[existingIdx]);
        }
        const session: ExamSession = {
          ...payload,
          id: payload.id || makeId('sess'),
          ...(computedGrade !== undefined ? { grade: computedGrade } : {}),
        };
        memoryStore.sessions.unshift(session);
        return res.status(201).json(session);
      }

      const { id: _ignoreId, ...mongoPayload } = payload;
      if (computedGrade !== undefined) mongoPayload.grade = computedGrade;
      const session = await ExamSessionModel.findOneAndUpdate(
        { examId: payload.examId, studentId: payload.studentId },
        { $set: mongoPayload },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      res.status(201).json(session);
    } catch (err: any) {
      if (err?.name === 'MongooseError' || err?.name === 'MongoNetworkError') return next(err);
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/sessions/grade', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { examId, answers, questionIds, status } = req.body as {
        examId?: string;
        answers?: Record<string, string>;
        questionIds?: string[];
        status?: string;
      };
      if (!examId || !answers || typeof answers !== 'object' || !Array.isArray(questionIds) || !questionIds.length) {
        return res.status(400).json({ error: 'Imtihon, savollar va javoblar kerak.' });
      }

      if (!isDbConnected) {
        const exam = memoryStore.exams.find((e) => e.id === examId);
        if (!exam) return res.status(404).json({ error: 'Nazorat ishi topilmadi.' });
        const questions = memoryStore.questions.filter(
          (q) => q.examId === examId && questionIds.includes(q.id)
        );
        const totalScore = questions.reduce((sum, question) => sum + question.points, 0);
        const score = questions.reduce(
          (sum, question) => sum + (answers[question.id] === question.correctOptionId ? question.points : 0),
          0
        );
        const percentage = totalScore ? Math.round((score / totalScore) * 100) : 0;
        return res.json({
          score,
          totalScore,
          percentage,
          grade: percentage >= 90 ? 5 : percentage >= 70 ? 4 : percentage >= 60 ? 3 : 2,
          passed: percentage >= exam.passingScore && status !== 'terminated',
        });
      }

      const exam = await ExamModel.findById(examId);
      if (!exam) return res.status(404).json({ error: 'Nazorat ishi topilmadi.' });
      const questions = await QuestionModel.find({ examId, _id: { $in: questionIds } });
      const totalScore = questions.reduce((sum, question) => sum + question.points, 0);
      const score = questions.reduce(
        (sum, question) => sum + (answers[String(question._id)] === question.correctOptionId ? question.points : 0),
        0
      );
      const percentage = totalScore ? Math.round((score / totalScore) * 100) : 0;
      res.json({
        score,
        totalScore,
        percentage,
        grade: percentage >= 90 ? 5 : percentage >= 70 ? 4 : percentage >= 60 ? 3 : 2,
        passed: percentage >= exam.passingScore && status !== 'terminated',
      });
    } catch (err) {
      next(err);
    }
  });

  // Atomic Anti-Cheat Violation ($inc & $push)
  app.put('/api/sessions/:id/violation', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { violation } = req.body;

      if (!isDbConnected) {
        const session = memoryStore.sessions.find((s) => s.id === id && s.status === 'in_progress');
        if (!session) return res.json(null);
        session.violationsCount = (session.violationsCount || 0) + 1;
        session.violations = [...(session.violations || []), violation];
        if (session.violationsCount >= 3) {
          session.status = 'terminated';
          session.terminationReason = "Xavfsizlik qoidalari 3 marta buzilganligi sababli test to'xtatildi.";
          session.submittedAt = new Date().toISOString();
        }
        return res.json(session);
      }

      const updated = await ExamSessionModel.findOneAndUpdate(
        { _id: id, status: 'in_progress' },
        {
          $inc: { violationsCount: 1 },
          $push: { violations: violation },
        },
        { new: true }
      );

      if (updated && updated.violationsCount >= 3) {
        updated.status = 'terminated';
        updated.terminationReason = "Xavfsizlik qoidalari 3 marta buzilganligi sababli test to'xtatildi.";
        updated.submittedAt = new Date();
        await updated.save();
      }

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/sessions/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        answers,
        questionIds,
        variant,
        score,
        totalScore,
        percentage,
        grade,
        passed,
        timeSpentSeconds,
        status,
        violationsCount,
        violations,
        terminationReason,
      } = req.body;

      const resolvedGrade =
        typeof grade === 'number'
          ? grade
          : percentage >= 90
          ? 5
          : percentage >= 70
          ? 4
          : percentage >= 60
          ? 3
          : 2;

      const updateFields: Record<string, unknown> = {
        answers,
        score,
        totalScore,
        percentage,
        grade: resolvedGrade,
        passed,
        timeSpentSeconds,
        status: status === 'terminated' ? 'terminated' : 'completed',
        submittedAt: new Date().toISOString(),
      };
      if (Array.isArray(questionIds)) updateFields.questionIds = questionIds;
      if (typeof variant === 'number') updateFields.variant = variant;
      if (typeof violationsCount === 'number') updateFields.violationsCount = violationsCount;
      if (Array.isArray(violations)) updateFields.violations = violations;
      if (typeof terminationReason === 'string') updateFields.terminationReason = terminationReason;

      if (!isDbConnected) {
        const session = memoryStore.sessions.find((s) => s.id === id);
        if (!session) return res.status(404).json({ error: 'Sessiya topilmadi' });
        Object.assign(session, updateFields);
        return res.json(session);
      }

      const updated = await ExamSessionModel.findByIdAndUpdate(
        id,
        {
          $set: {
            ...updateFields,
            submittedAt: new Date(),
          },
        },
        { new: true }
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Aggregation Pipeline for Analytics
  app.get('/api/analytics/exam/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!isDbConnected) {
        const examSessions = memoryStore.sessions.filter((s) => s.examId === id);
        if (examSessions.length === 0) return res.json(null);
        const totalStudents = examSessions.length;
        return res.json({
          _id: id,
          totalStudents,
          avgScore: examSessions.reduce((acc, s) => acc + s.score, 0) / totalStudents,
          passedCount: examSessions.filter((s) => s.passed).length,
          avgViolations: examSessions.reduce((acc, s) => acc + (s.violationsCount || 0), 0) / totalStudents,
        });
      }

      const stats = await ExamSessionModel.aggregate([
        { $match: { examId: id } },
        {
          $group: {
            _id: '$examId',
            totalStudents: { $sum: 1 },
            avgScore: { $avg: '$score' },
            passedCount: { $sum: { $cond: ['$passed', 1, 0] } },
            avgViolations: { $avg: '$violationsCount' },
          },
        },
      ]);
      res.json(stats[0] || null);
    } catch (err) {
      next(err);
    }
  });

  // Database offline / Mongoose error fallback middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (
      err?.name === 'MongooseError' ||
      err?.name === 'MongoNetworkError' ||
      err?.message?.includes('buffering timed out')
    ) {
      console.warn('[AI Studio] Database offline — returning mock empty response');
      if (req.method === 'GET') {
        return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
      }
      return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
    }
    next(err);
  });

  // ==================== VITE SPA FRONTEND ====================
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 EduExam Secure server is running on http://0.0.0.0:${PORT}`);
    console.log(
      isDbConnected
        ? '🍃 Connected to MongoDB'
        : '💾 Running in In-Memory mode (seeded with initialData)'
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
