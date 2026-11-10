/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export type ExamType = 'ORALIQ_1' | 'ORALIQ_2' | 'YAKUNIY';

export interface IExam extends Document {
  subjectId: mongoose.Types.ObjectId;
  subjectName: string;
  title: string;
  type: ExamType;
  durationMinutes: number;
  passingScore: number;
  maxAttempts: number;
  groupIds: string[];
  isActive: boolean;
  startedAt?: Date;
  stoppedAt?: Date;
  totalPoints: number;
  questionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ExamSchema = new Schema<IExam>(
  {
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['ORALIQ_1', 'ORALIQ_2', 'YAKUNIY'],
      default: 'ORALIQ_1',
      required: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      default: 20,
    },
    passingScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 60,
    },
    maxAttempts: {
      type: Number,
      default: 1,
      min: 1,
    },
    groupIds: [
      {
        type: String,
        index: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    startedAt: {
      type: Date,
    },
    stoppedAt: {
      type: Date,
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    questionCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying active exams assigned to a student's group
ExamSchema.index({ groupIds: 1, isActive: 1 });

export const ExamModel: Model<IExam> =
  mongoose.models.Exam || mongoose.model<IExam>('Exam', ExamSchema);
