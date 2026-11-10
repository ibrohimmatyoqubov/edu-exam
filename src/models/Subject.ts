/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISubject extends Document {
  name: string; // e.g. "Matematika", "Veb Dasturlash"
  code: string; // e.g. "MATH-101", "CS-204"
  createdAt: Date;
  updatedAt: Date;
}

const SubjectSchema = new Schema<ISubject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const SubjectModel: Model<ISubject> =
  mongoose.models.Subject || mongoose.model<ISubject>('Subject', SubjectSchema);
