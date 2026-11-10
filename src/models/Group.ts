/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGroup extends Document {
  name: string; // e.g. "01-26", "02-26", "KTD04-26"
  description?: string;
  studentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema = new Schema<IGroup>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    studentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const GroupModel: Model<IGroup> =
  mongoose.models.Group || mongoose.model<IGroup>('Group', GroupSchema);
