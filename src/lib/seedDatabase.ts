/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose from 'mongoose';
import connectToDatabase from './mongodb';
import {
  UserModel,
  GroupModel,
  SubjectModel,
  ExamModel,
  QuestionModel,
  ExamSessionModel,
} from '../models';
import {
  initialGroups,
  initialUsers,
  initialSubjects,
  initialExams,
  initialQuestions,
  initialExamSessions,
} from '../data/initialData';

const SEED_META_ID = 'initial_seed_v1';

export async function seedDatabaseIfEmpty() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (db) {
      const metaCol = db.collection<{ _id: string; seededAt: Date }>('app_meta');
      const existingMarker = await metaCol.findOne({ _id: SEED_META_ID });
      if (existingMarker) {
        console.log("📦 MongoDB ma'lumotlar bazasi allaqachon ishga tushirilgan (statik data qayta yozilmaydi).");
        return;
      }

      const [userCount, groupCount, subjectCount, examCount] = await Promise.all([
        UserModel.countDocuments(),
        GroupModel.countDocuments(),
        SubjectModel.countDocuments(),
        ExamModel.countDocuments(),
      ]);

      if (userCount > 0 || groupCount > 0 || subjectCount > 0 || examCount > 0) {
        await metaCol.updateOne(
          { _id: SEED_META_ID },
          { $setOnInsert: { seededAt: new Date() } },
          { upsert: true }
        );
        console.log(`📦 MongoDB ma'lumotlar bazasi tayyor (${userCount} ta foydalanuvchi, ${groupCount} ta guruh mavjud).`);
        return;
      }
    } else {
      const userCount = await UserModel.countDocuments();
      if (userCount > 0) {
        console.log(`📦 MongoDB Atlas ma'lumotlar bazasi tayyor (${userCount} ta foydalanuvchi mavjud).`);
        return;
      }
    }

    console.log("🌱 MongoDB bo'sh, bir martalik boshlang'ich ma'lumotlar kiritilmoqda...");

    // 1. Groups
    const groupDocs = initialGroups.map((g) => ({
      _id: g.id.startsWith('grp-') ? undefined : g.id,
      name: g.name,
      description: g.description,
      studentCount: g.studentCount,
      createdAt: new Date(g.createdAt),
      updatedAt: new Date(),
    }));
    const insertedGroups = await GroupModel.insertMany(groupDocs);
    const groupMap = new Map<string, string>();
    initialGroups.forEach((orig, idx) => {
      groupMap.set(orig.id, insertedGroups[idx]._id.toString());
    });

    // 2. Users
    const userDocs = initialUsers.map((u) => ({
      fullName: u.fullName,
      email: u.email,
      studentId: u.studentId,
      password: u.password,
      role: u.role,
      groupId: u.groupId ? groupMap.get(u.groupId) || u.groupId : undefined,
      groupName: u.groupName,
      createdAt: new Date(u.createdAt),
      updatedAt: new Date(),
    }));
    await UserModel.insertMany(userDocs);

    // 3. Subjects
    const subjectDocs = initialSubjects.map((s) => ({
      name: s.name,
      code: s.code,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(),
    }));
    const insertedSubjects = await SubjectModel.insertMany(subjectDocs);
    const subjectMap = new Map<string, string>();
    initialSubjects.forEach((orig, idx) => {
      subjectMap.set(orig.id, insertedSubjects[idx]._id.toString());
    });

    // 4. Exams
    const examDocs = initialExams.map((e) => ({
      subjectId: subjectMap.get(e.subjectId) || insertedSubjects[0]._id,
      subjectName: e.subjectName,
      title: e.title,
      type: e.type,
      durationMinutes: e.durationMinutes,
      passingScore: e.passingScore,
      maxAttempts: e.maxAttempts,
      groupIds: e.groupIds.map((gid) => groupMap.get(gid) || gid),
      isActive: e.isActive,
      startedAt: e.startedAt ? new Date(e.startedAt) : undefined,
      totalPoints: e.totalPoints,
      questionCount: e.questionCount,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(),
    }));
    const insertedExams = await ExamModel.insertMany(examDocs);
    const examMap = new Map<string, string>();
    initialExams.forEach((orig, idx) => {
      examMap.set(orig.id, insertedExams[idx]._id.toString());
    });

    // 5. Questions
    const questionDocs = initialQuestions.map((q) => ({
      examId: examMap.get(q.examId) || insertedExams[0]._id,
      questionText: q.questionText,
      codeSnippet: q.codeSnippet,
      options: q.options,
      correctOptionId: q.correctOptionId,
      points: q.points,
      explanation: q.explanation,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await QuestionModel.insertMany(questionDocs);

    // 6. Exam Sessions
    const sessionDocs = initialExamSessions.map((s) => ({
      examId: examMap.get(s.examId) || insertedExams[0]._id,
      examTitle: s.examTitle,
      subjectName: s.subjectName,
      studentId: s.studentId,
      studentName: s.studentName,
      studentEmail: s.studentEmail,
      groupId: groupMap.get(s.groupId) || s.groupId,
      groupName: s.groupName,
      status: s.status,
      startedAt: new Date(s.startedAt),
      submittedAt: s.submittedAt ? new Date(s.submittedAt) : undefined,
      timeSpentSeconds: s.timeSpentSeconds,
      answers: s.answers,
      score: s.score,
      totalScore: s.totalScore,
      percentage: s.percentage,
      passed: s.passed,
      violationsCount: s.violationsCount,
      terminationReason: s.terminationReason,
      violations: s.violations.map((v) => ({
        ...v,
        timestamp: new Date(v.timestamp),
      })),
      createdAt: new Date(s.startedAt),
      updatedAt: new Date(),
    }));
    await ExamSessionModel.insertMany(sessionDocs);

    if (db) {
      await db.collection<{ _id: string; seededAt: Date }>('app_meta').updateOne(
        { _id: SEED_META_ID },
        { $setOnInsert: { seededAt: new Date() } },
        { upsert: true }
      );
    }

    console.log("✅ MongoDB Atlas bazasi muvaffaqiyatli boshlang'ich ma'lumotlar bilan to'ldirildi!");
  } catch (error) {
    console.error("MongoDB Atlas seed xatosi:", error);
  }
}
