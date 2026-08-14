// lib/db.ts
import * as SQLite from "expo-sqlite";

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Opens (and caches) the single app database connection.
 * Uses the modern async expo-sqlite API (SDK 51+).
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await SQLite.openDatabaseAsync("grato_offline.db");

  await dbInstance.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,              -- e.g. 'refuel_submit', 'maintenance_complete'
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,            -- 'POST' | 'PATCH' | 'PUT'
      payload TEXT NOT NULL,           -- JSON string (may reference local file:// paths)
      status TEXT NOT NULL DEFAULT 'pending',  -- pending | uploading | syncing | synced | failed
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cache (
      cache_key TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,              -- JSON string
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);
  `);

  return dbInstance;
}
