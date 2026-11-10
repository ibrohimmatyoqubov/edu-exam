/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.set('bufferCommands', false);

/**
 * MongoDB Atlas yoki Local MongoDB ulanish klienti
 * Ulanish pool'i va keshini boshqaradi
 */
export function getMongoUri(): string {
  return process.env.MONGODB_URI || '';
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  const uri = getMongoUri();
  if (!uri) {
    throw new Error('MONGODB_URI is not configured — using in-memory fallback');
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      console.log('✅ MongoDB bazasiga muvaffaqiyatli ulandi:', uri.split('@')[1] || uri);
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.warn('⚠️ MongoDB ulanishida xatolik — in-memory rejim ishlatiladi:', e instanceof Error ? e.message : e);
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
