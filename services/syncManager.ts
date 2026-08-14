// services/syncManager.ts
import NetInfo from "@react-native-community/netinfo";
import { api, uploadAPI } from "./api";
import {
  getPendingItems,
  removeItem,
  updateItem,
  countPending,
  QueueItem,
} from "../lib/syncQueue";
import { markLocalPurchaseSynced } from "../lib/localPurchases";
import { getLocalWorkflow, setLocalWorkflow } from "../lib/workflowCache";

// ── Simple event emitter so UI can show "Syncing…" / "3 pending" badges ──
type Listener = (info: { pending: number; syncing: boolean }) => void;
const listeners: Listener[] = [];

export function subscribeSync(listener: Listener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

let isSyncing = false;

async function notify() {
  const pending = await countPending();
  listeners.forEach((l) => l({ pending, syncing: isSyncing }));
}

/**
 * Recursively finds local file:// / content:// URIs inside a payload,
 * uploads each one, and replaces it in place with the remote URL.
 * Mirrors uploadAPI.processAndUploadData but works on an already-queued payload.
 */
async function uploadEmbeddedPhotos(payload: any): Promise<any> {
  return uploadAPI.processAndUploadData(payload);
}

/** Processes one queue item. Returns true if it should be considered "done" (synced or permanently failed). */
async function processItem(item: QueueItem): Promise<boolean> {
  try {
    await updateItem(item.id, { status: "uploading" });

    // Step 1: upload any local photos still embedded in the payload
    const resolvedPayload = await uploadEmbeddedPhotos(item.payload);

    await updateItem(item.id, { status: "syncing", payload: resolvedPayload });

    // Step 2: fire the real request
    const method = item.method.toLowerCase() as "post" | "patch" | "put";
    const response = await api[method](item.endpoint, resolvedPayload);

    // ── Post-sync side effects for offline-first entities ───────────────────
    if (item.type === "fuel_purchase_create" && resolvedPayload?.client_id) {
      // The local overlay list (used so a purchase created offline is
      // immediately usable for other sites) can now be cleared for this
      // one -- cachedGet's own cache will pick up the real server record
      // next time the purchases list is fetched online.
      await markLocalPurchaseSynced(resolvedPayload.client_id).catch(() => {});
    }

    if (item.type === "refuel_workflow_start" && resolvedPayload?.siteId) {
      // Now that the server workflow exists for real, swap the local
      // workflow's placeholder "local:<clientId>" id for the real server
      // _id, so subsequent status patches for this site resolve by _id
      // instead of by client_id going forward.
      const realId = response?.data?.data?._id;
      if (realId) {
        const local = await getLocalWorkflow(resolvedPayload.siteId);
        if (local && local._id?.startsWith("local:")) {
          await setLocalWorkflow(resolvedPayload.siteId, { ...local, _id: realId }).catch(() => {});
        }
      }
    }

    // Success — remove from the outbox entirely
    await removeItem(item.id);
    return true;
  } catch (err: any) {
    const isNetworkError = !err?.response;
    const attempts = item.attempts + 1;

    if (isNetworkError) {
      // Connectivity dropped mid-sync — leave as pending, retry later, stop this pass.
      await updateItem(item.id, { status: "pending", attempts });
      return false;
    }

    // A real server error (validation, 4xx/5xx) — mark failed so the user can
    // review it, but don't silently retry forever on bad data.
    const message =
      err?.response?.data?.message || err?.response?.data?.error || err?.message || "Sync failed";
    await updateItem(item.id, { status: "failed", attempts, last_error: message });
    // Keep draining the rest of the queue — one bad item shouldn't block others.
    return true;
  }
}

/** Drains the whole outbox, in order, stopping early if connectivity is lost. */
export async function processQueue(): Promise<void> {
  if (isSyncing) return; // already running
  const net = await NetInfo.fetch();
  if (!net.isConnected || net.isInternetReachable === false) return;

  isSyncing = true;
  await notify();

  try {
    const items = await getPendingItems();
    for (const item of items) {
      const netNow = await NetInfo.fetch();
      if (!netNow.isConnected || netNow.isInternetReachable === false) break;

      const done = await processItem(item);
      if (!done) break; // network dropped — stop, will resume on reconnect
      await notify();
    }
  } finally {
    isSyncing = false;
    await notify();
  }
}

let started = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

/** Call once, e.g. from your root layout, after the DB is ready. */
export function startSyncManager() {
  if (started) return;
  started = true;

  // Sync immediately, then whenever connectivity is (re)gained.
  processQueue();

  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      processQueue();
    }
  });

  // Safety-net poll every 30s while the app is foregrounded, in case a
  // NetInfo event was missed or a partial sync stalled.
  intervalHandle = setInterval(() => {
    processQueue();
  }, 30000);
}

export function stopSyncManager() {
  if (intervalHandle) clearInterval(intervalHandle);
  started = false;
}

export async function retryFailedItem(id: string) {
  await updateItem(id, { status: "pending", last_error: null });
  processQueue();
}
