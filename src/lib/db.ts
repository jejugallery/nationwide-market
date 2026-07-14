import { neon } from '@neondatabase/serverless';

let dbInstance: any = null;

function getDb() {
  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not defined.');
  }

  dbInstance = neon(databaseUrl);
  return dbInstance;
}

// Proxy function to lazily invoke neon SQL queries only when called
export const sql = (strings: TemplateStringsArray, ...values: any[]) => {
  const db = getDb();
  return db(strings, ...values);
};
