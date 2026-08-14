// lib/workflowCache.ts
//
// A "workflow" (refuel visit progress: activated -> purchase_selected ->
// checked_in -> form_submitted -> checked_out) needs to exist and be
// resumable EVEN IF the device never touches the network during the whole
// visit. This module is the local source of truth for that -- the server
// copy is kept in sync opportunistically when online, but nothing about
// progressing through a site visit ever *requires* a network call.

import { cacheGet, cacheSet } from "./syncQueue";

export interface LocalWorkflow {
  _id?: string; // real server _id -- only present once this workflow has synced online at least once
  site_id: string;
  workflow_status: string;
  workflow_history: { status: string; timestamp: string; meta?: any }[];
}

const cacheKey = (siteId: string) => `refuel_workflow_local:${siteId}`;

export async function getLocalWorkflow(siteId: string): Promise<LocalWorkflow | null> {
  const cached = await cacheGet<LocalWorkflow>(cacheKey(siteId));
  return cached?.data ?? null;
}

export async function setLocalWorkflow(siteId: string, workflow: LocalWorkflow): Promise<void> {
  await cacheSet(cacheKey(siteId), workflow);
}

/** Appends one step to this site's local workflow history and updates its status. */
export async function appendLocalStatus(
  siteId: string,
  status: string,
  meta?: any,
  serverId?: string,
): Promise<LocalWorkflow> {
  const existing = await getLocalWorkflow(siteId);
  const entry = { status, timestamp: new Date().toISOString(), meta: meta || {} };
  const workflow: LocalWorkflow = existing
    ? {
        ...existing,
        _id: serverId ?? existing._id,
        workflow_status: status,
        workflow_history: [...existing.workflow_history, entry],
      }
    : {
        _id: serverId,
        site_id: siteId,
        workflow_status: status,
        workflow_history: [entry],
      };
  await setLocalWorkflow(siteId, workflow);
  return workflow;
}

/** Call once a site's visit has been fully submitted and synced -- starts the next visit clean. */
export async function clearLocalWorkflow(siteId: string): Promise<void> {
  await setLocalWorkflow(siteId, { site_id: siteId, workflow_status: "", workflow_history: [] });
}



