/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export type SessionStatus = 'in_progress' | 'completed' | 'terminated';
export type ViolationType =
  | 'tab_switch'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'forbidden_key'
  | 'context_menu';

export interface IViolation {
  id: string;
  type: ViolationType;
  timestamp: Date;
  details: string;
}

export interface IExamSession extends Document {
  examId: mongoose.Types.ObjectId;
  examTitle: string;
  subjectName: string;
  studentId: string; // EDU- ID
  studentName: string;
  studentEmail?: string;
  groupId: string;
  groupName: string;
  status: SessionStatus;
  startedAt: Date;
  submittedAt?: Date;
  timeSpentSeconds: number;
  answers: Map<string, string>; // questionId -> optionId
  questionIds: string[];
  variant?: number;
  score: number;
  totalScore: number;
  percentage: number;
  grade?: number;
  passed: boolean;
  violationsCount: number;
  terminationReason?: string;
  violations: IViolation[];
  createdAt: Date;
  updatedAt: Date;
}

const ViolationSchema = new Schema<IViolation>(
  {
    id: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        'tab_switch',
        'window_blur',
        'fullscreen_exit',
        'forbidden_key',
        'context_menu',
      ],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const ExamSessionSchema = new Schema<IExamSession>(
  {
    examId: {
      type: Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },
    examTitle: {
      type: String,
      required: true,
    },
    subjectName: {
      type: String,
      required: true,
    },
    studentId: {
      type: String,
      required: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    studentEmail: {
      type: String,
    },
    groupId: {
      type: String,
      required: true,
      index: true,
    },
    groupName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'terminated'],
      default: 'in_progress',
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
    },
    answers: {
      type: Map,
      of: String,
      default: {},
    },
    questionIds: { type: [String], default: [] },
    variant: { type: Number },
    score: {
      type: Number,
      default: 0,
    },
    totalScore: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    grade: {
      type: Number,
      min: 2,
      max: 5,
    },
    passed: {
      type: Boolean,
      default: false,
    },
    violationsCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    terminationReason: {
      type: String,
    },
    violations: {
      type: [ViolationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// High concurrency indexes: ensures rapid lookups during live monitoring of 100+ concurrent students
ExamSessionSchema.index({ examId: 1, studentId: 1 }, { unique: true });
ExamSessionSchema.index({ examId: 1, status: 1 });
ExamSessionSchema.index({ groupId: 1, examId: 1 });

export const ExamSessionModel: Model<IExamSession> =
  mongoose.models.ExamSession ||
  mongoose.model<IExamSession>('ExamSession', ExamSessionSchema);
