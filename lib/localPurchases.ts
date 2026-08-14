// lib/localPurchases.ts
//
// A fuel purchase created while offline must be usable for OTHER sites
// immediately, in the same offline session -- not just after it eventually
// syncs. cachedGet('/technician/fuel-purchases/active') only ever reflects
// the last successful server fetch, so a purchase created locally needs to
// be tracked separately and merged in until it's confirmed synced.

import { cacheGet, cacheSet } from "./syncQueue";

export interface LocalFuelPurchase {
  client_id: string;
  purchase_date: string;
  total_quantity: number;
  remaining_quantity: number; // decremented locally as sites draw from it, same as the server would
  truck_plate_number?: string;
  synced: boolean; // true once the create + at least one allocation round-trip has been confirmed online
}

const KEY = "local_fuel_purchases";

export async function getLocalPurchases(): Promise<LocalFuelPurchase[]> {
  const cached = await cacheGet<LocalFuelPurchase[]>(KEY);
  return cached?.data ?? [];
}

export async function addLocalPurchase(purchase: LocalFuelPurchase): Promise<void> {
  const list = await getLocalPurchases();
  await cacheSet(KEY, [purchase, ...list]);
}

/** Decrement a local purchase's remaining balance when a site draws from it (mirrors server behavior). */
export async function drawDownLocalPurchase(clientId: string, quantity: number): Promise<void> {
  const list = await getLocalPurchases();
  const updated = list.map((p) =>
    p.client_id === clientId
      ? { ...p, remaining_quantity: Math.max(0, p.remaining_quantity - quantity) }
      : p,
  );
  await cacheSet(KEY, updated);
}

/** Call once a locally-created purchase is confirmed synced -- removes it from the local overlay so the server copy (now in cachedGet's cache) is the single source going forward. */
export async function markLocalPurchaseSynced(clientId: string): Promise<void> {
  const list = await getLocalPurchases();
  await cacheSet(KEY, list.filter((p) => p.client_id !== clientId));
}
