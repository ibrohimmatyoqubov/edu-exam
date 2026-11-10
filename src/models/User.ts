/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'ADMIN' | 'STUDENT';

export interface IUser extends Document {
  fullName: string;
  email?: string;
  studentId?: string; // e.g. "EDU-0126-001"
  password?: string;  // e.g. "0126-Anvar"
  role: UserRole;
  groupId?: string;
  groupName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
    },
    studentId: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'STUDENT'],
      default: 'STUDENT',
      required: true,
      index: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      index: true,
    },
    groupName: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast student lookup in group
UserSchema.index({ groupId: 1, role: 1 });

export const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
