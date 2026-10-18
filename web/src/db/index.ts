import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Created on first use so `next build` doesn't need DATABASE_URL.
function createDb() {
  return drizzle(neon(process.env.DATABASE_URL!), { schema });
}

let db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!db) db = createDb();
  return db;
}
