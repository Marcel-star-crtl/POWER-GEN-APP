// lib/whatsappShareQueue.ts
//
// "Share later" queue for the post-submit WhatsApp report popup
// (components/ui/WhatsAppSharePopup.tsx). A technician who can't share
// right when they submit — no signal, in a hurry, WhatsApp not
// installed, changed their mind — taps "Share Later" instead of losing
// the report: it's saved here and surfaced again from the Pending
// WhatsApp Shares screen (app/(technician)/pending-whatsapp-shares.tsx)
// and a banner on the dashboard.
//
// Deliberately reuses the existing SQLite `cache` key/value table (via
// cacheGet/cacheSet in lib/syncQueue.ts) rather than a new table + schema
// migration — this list is small, per-device, and isn't part of the
// server-sync outbox (sharing to WhatsApp is a manual, human action; no
// background job can do it on the technician's behalf), so a single
// JSON blob under one cache key is the right amount of machinery. It is
// NOT cleared by signOut() on purpose — an unsent report shouldn't
// silently vanish if a technician logs out and back in.

import * as Crypto from "expo-crypto";
import { cacheGet, cacheSet } from "./syncQueue";

const CACHE_KEY = "whatsapp_pending_shares";

export interface PendingWhatsAppSharePhoto {
  uri: string;
  label: string;
}

export interface PendingWhatsAppShare {
  id: string;
  created_at: number;
  site_id: string;
  site_name: string;
  message: string;
  photos: PendingWhatsAppSharePhoto[];
}

async function readAll(): Promise<PendingWhatsAppShare[]> {
  const cached = await cacheGet<PendingWhatsAppShare[]>(CACHE_KEY);
  return cached?.data ?? [];
}

async function writeAll(items: PendingWhatsAppShare[]): Promise<void> {
  await cacheSet(CACHE_KEY, items);
}

/** Most recent first — a technician reopening this list most likely wants
 * to finish today's report, not scroll past a backlog to find it. */
export async function getPendingShares(): Promise<PendingWhatsAppShare[]> {
  const all = await readAll();
  return [...all].sort((a, b) => b.created_at - a.created_at);
}

export async function countPendingShares(): Promise<number> {
  return (await readAll()).length;
}

export async function addPendingShare(
  share: Omit<PendingWhatsAppShare, "id" | "created_at">,
): Promise<string> {
  const all = await readAll();
  const id = Crypto.randomUUID();
  all.push({ ...share, id, created_at: Date.now() });
  await writeAll(all);
  return id;
}

export async function removePendingShare(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((s) => s.id !== id));
}
