// services/offlineApi.ts
//
// NOTE: imports from "expo-file-system/legacy", not "expo-file-system".
// SDK 54 deprecated getInfoAsync/makeDirectoryAsync/copyAsync on the new
// File/Directory-class API; the legacy import keeps the same function
// signatures used below without the deprecation warning. Migrate to the
// new File/Directory classes later if you want — this is the officially
// documented stopgap (see https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/).
import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { api, uploadAPI } from "./api";
import { isNetworkAvailable } from "../hooks/useNetworkStatus";
import { enqueue, cacheGet, cacheSet } from "../lib/syncQueue";
import { processQueue } from "./syncManager";

/**
 * Generate once, per submission, and include as `client_id` in the payload
 * for any endpoint that CREATES a new document (not one that just patches a
 * status). This id stays fixed across retries — including retries driven by
 * the offline queue — so the backend can no-op a duplicate create instead of
 * making a second record. See offlineApi usage examples in the audit/refuel
 * submit handlers.
 */
export function generateClientId(): string {
  return Crypto.randomUUID();
}

const PHOTO_DIR = FileSystem.documentDirectory + "offline_photos/";

async function ensurePhotoDir() {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

/**
 * Copies a captured photo (which may live in a volatile cache dir) into
 * permanent app storage so it survives until the queue can sync it.
 * Safe to call on any file:// / content:// uri; no-ops on remote URLs.
 */
export async function persistLocalPhoto(uri: string): Promise<string> {
  if (!uri.startsWith("file://") && !uri.startsWith("content://")) return uri;
  await ensurePhotoDir();
  const ext = uri.split(".").pop()?.split("?")[0] || "jpg";
  const dest = `${PHOTO_DIR}${Date.now()}_${Math.round(Math.random() * 1e6)}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

/** Recursively persists every local photo URI found in a form payload. */
export async function persistPhotosInPayload(payload: any): Promise<any> {
  if (payload == null) return payload;

  if (typeof payload === "string") {
    return persistLocalPhoto(payload);
  }
  if (Array.isArray(payload)) {
    const out = [];
    for (const item of payload) out.push(await persistPhotosInPayload(item));
    return out;
  }
  if (typeof payload === "object") {
    if (payload.uri && typeof payload.uri === "string") {
      return { ...payload, uri: await persistLocalPhoto(payload.uri) };
    }
    const out: any = {};
    for (const key of Object.keys(payload)) {
      out[key] = await persistPhotosInPayload(payload[key]);
    }
    return out;
  }
  return payload;
}

export interface SubmitResult {
  queued: boolean; // true if it went to the offline outbox instead of syncing immediately
  queueId?: string;
  data?: any; // server response, only present when queued === false
}

/**
 * Use this instead of calling `api.post/patch/put` directly from a form's
 * submit handler — and stop calling `uploadAPI.processAndUploadData`
 * yourself beforehand. Pass the RAW payload, local photo URIs and all;
 * this function owns uploading them.
 *
 * Online: uploads any embedded local photos, then submits. If the upload
 *   or submit dies mid-flight from a network drop, falls back to queueing.
 * Offline: skips the doomed upload attempt entirely, persists photos to
 *   permanent storage, and queues the whole thing for later.
 *
 * Either way this returns immediately — the UI can proceed as if submitted.
 */
export async function submitOrQueue(
  type: string,
  endpoint: string,
  method: "POST" | "PATCH" | "PUT",
  rawPayload: any,
): Promise<SubmitResult> {
  const online = await isNetworkAvailable();

  if (online) {
    try {
      const resolvedPayload = await uploadAPI.processAndUploadData(rawPayload);
      const httpMethod = method.toLowerCase() as "post" | "patch" | "put";
      const response = await api[httpMethod](endpoint, resolvedPayload);
      return { queued: false, data: response.data };
    } catch (err: any) {
      // Only fall back to queueing on a genuine connectivity failure.
      // Real validation/server errors (4xx/5xx) should surface to the user.
      if (err?.response) throw err;
      // else: network died mid-upload/submit — fall through to queueing below
    }
  }

  const safePayload = await persistPhotosInPayload(rawPayload);
  const queueId = await enqueue(type, endpoint, method, safePayload);
  // Fire-and-forget: in case connectivity is actually there, try immediately.
  processQueue();
  return { queued: true, queueId };
}

/**
 * Cached GET: fetches fresh data when online (and updates the cache),
 * falls back to the last cached value when offline.
 */
export async function cachedGet<T = any>(endpoint: string, params?: any): Promise<{ data: T; fromCache: boolean }> {
  const cacheKey = `${endpoint}?${JSON.stringify(params || {})}`;
  const online = await isNetworkAvailable();

  if (online) {
    try {
      const response = await api.get(endpoint, { params });
      await cacheSet(cacheKey, response.data);
      return { data: response.data, fromCache: false };
    } catch (err: any) {
      if (err?.response) throw err; // real server error, don't mask it
      // network error — fall through to cache
    }
  }

  const cached = await cacheGet<T>(cacheKey);
  if (cached) return { data: cached.data, fromCache: true };
  throw new Error("No internet connection and no cached data available.");
}
