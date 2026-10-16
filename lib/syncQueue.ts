// lib/syncQueue.ts
import * as Crypto from "expo-crypto";
import { getDb } from "./db";

export type QueueStatus = "pending" | "uploading" | "syncing" | "synced" | "failed";

export interface QueueItem {
  id: string;
  type: string;
  endpoint: string;
  method: "POST" | "PATCH" | "PUT";
  payload: any; // parsed JS object
  status: QueueStatus;
  attempts: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

function rowToItem(row: any): QueueItem {
  return {
    id: row.id,
    type: row.type,
    endpoint: row.endpoint,
    method: row.method,
    payload: JSON.parse(row.payload),
    status: row.status,
    attempts: row.attempts,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Adds a new item to the outbox. Returns the generated queue id. */
export async function enqueue(
  type: string,
  endpoint: string,
  method: "POST" | "PATCH" | "PUT",
  payload: any,
): Promise<string> {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO sync_queue (id, type, endpoint, method, payload, status, attempts, last_error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?)`,
    [id, type, endpoint, method, JSON.stringify(payload), now, now],
  );

  return id;
}

export async function getPendingItems(): Promise<QueueItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM sync_queue WHERE status IN ('pending','failed') ORDER BY created_at ASC`,
  );
  return rows.map(rowToItem);
}

/**
 * Resets any item still stuck at "uploading" or "syncing" back to "pending".
 *
 * Those two statuses only ever exist transiently while processItem() is
 * mid-flight (see services/syncManager.ts). If the app is killed, crashes,
 * or the process is otherwise torn down while an item is in one of those
 * states, it's left stranded there forever: getPendingItems() only selects
 * 'pending'/'failed', so the item is silently never retried and the
 * technician's submitted record is effectively lost, even though
 * countPending() keeps counting it (so the UI still shows it as
 * "N pending" with no way to make progress on it).
 *
 * Call this once at app start, before the first processQueue() call, so any
 * item orphaned by a previous session's abrupt termination gets picked back
 * up on the next sync pass.
 */
export async function resetOrphanedItems(): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE sync_queue SET status = 'pending', updated_at = ? WHERE status IN ('uploading','syncing')`,
    [Date.now()],
  );
  return result.changes ?? 0;
}

export async function getAllItems(): Promise<QueueItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(`SELECT * FROM sync_queue ORDER BY created_at DESC`);
  return rows.map(rowToItem);
}

export async function updateItem(
  id: string,
  patch: Partial<Pick<QueueItem, "payload" | "status" | "attempts" | "last_error">>,
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (patch.payload !== undefined) {
    fields.push("payload = ?");
    values.push(JSON.stringify(patch.payload));
  }
  if (patch.status !== undefined) {
    fields.push("status = ?");
    values.push(patch.status);
  }
  if (patch.attempts !== undefined) {
    fields.push("attempts = ?");
    values.push(patch.attempts);
  }
  if (patch.last_error !== undefined) {
    fields.push("last_error = ?");
    values.push(patch.last_error);
  }
  fields.push("updated_at = ?");
  values.push(Date.now());
  values.push(id);

  await db.runAsync(`UPDATE sync_queue SET ${fields.join(", ")} WHERE id = ?`, values);
}

export async function removeItem(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM sync_queue WHERE status IN ('pending','uploading','syncing','failed')`,
  );
  return row?.c ?? 0;
}

// ── Read-cache (for offline browsing of tasks/sites/etc.) ─────────────────

export async function cacheSet(key: string, data: any): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO cache (cache_key, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [key, JSON.stringify(data), Date.now()],
  );
}

export async function cacheGet<T = any>(key: string): Promise<{ data: T; updated_at: number } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string; updated_at: number }>(
    `SELECT data, updated_at FROM cache WHERE cache_key = ?`,
    [key],
  );
  if (!row) return null;
  return { data: JSON.parse(row.data), updated_at: row.updated_at };
}
