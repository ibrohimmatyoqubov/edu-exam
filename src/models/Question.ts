/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOption {
  id: string; // e.g. "opt-a", "opt-b"
  text: string;
}

export interface IQuestion extends Document {
  examId: mongoose.Types.ObjectId;
  questionText: string;
  codeSnippet?: string;
  options: IOption[];
  correctOptionId: string;
  points: number;
  explanation?: string;
  variant: number;
  createdAt: Date;
  updatedAt: Date;
}

const OptionSchema = new Schema<IOption>(
  {
    id: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const QuestionSchema = new Schema<IQuestion>(
  {
    examId: {
      type: Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    codeSnippet: {
      type: String,
      trim: true,
    },
    options: {
      type: [OptionSchema],
      validate: [
        (val: IOption[]) => val.length >= 2,
        'Kamida 2 ta javob varianti kiritilishi shart!',
      ],
    },
    correctOptionId: {
      type: String,
      required: true,
      select: true, // In secure student API endpoints, projected out via .select('-correctOptionId')
    },
    points: {
      type: Number,
      required: true,
      default: 5,
      min: 1,
    },
    explanation: {
      type: String,
      trim: true,
    },
    variant: { type: Number, min: 1, max: 5, default: 1, index: true },
  },
  {
    timestamps: true,
  }
);

export const QuestionModel: Model<IQuestion> =
  mongoose.models.Question ||
  mongoose.model<IQuestion>('Question', QuestionSchema);
