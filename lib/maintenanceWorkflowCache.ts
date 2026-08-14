// lib/maintenanceWorkflowCache.ts
//
// Mirrors workflowCache.ts for the maintenance (PM) flow. Simpler than the
// refuel case: a maintenance workflow's status/history live directly on the
// Maintenance document, and `workflowId === maintenanceId` -- a real,
// already-existing server ID from the moment the task was scheduled. So
// there's no need for the "local:<clientId>" placeholder scheme refueling
// needed; we just need the local cache to make progress resumable and
// non-blocking while offline.

import { cacheGet, cacheSet } from "./syncQueue";

export interface LocalMaintenanceWorkflow {
  maintenance_id: string;
  workflow_status: string;
  workflow_history: { status: string; timestamp: string; meta?: any }[];
}

const cacheKey = (maintenanceId: string) => `maintenance_workflow_local:${maintenanceId}`;

export async function getLocalMaintenanceWorkflow(
  maintenanceId: string,
): Promise<LocalMaintenanceWorkflow | null> {
  const cached = await cacheGet<LocalMaintenanceWorkflow>(cacheKey(maintenanceId));
  return cached?.data ?? null;
}

export async function setLocalMaintenanceWorkflow(
  maintenanceId: string,
  workflow: LocalMaintenanceWorkflow,
): Promise<void> {
  await cacheSet(cacheKey(maintenanceId), workflow);
}

export async function appendLocalMaintenanceStatus(
  maintenanceId: string,
  status: string,
  meta?: any,
): Promise<LocalMaintenanceWorkflow> {
  const existing = await getLocalMaintenanceWorkflow(maintenanceId);
  const entry = { status, timestamp: new Date().toISOString(), meta: meta || {} };

  // Mirrors the backend's first-write-wins behavior locally too, so the
  // local timeline doesn't accumulate duplicate entries for a status
  // that's patched more than once (e.g. re-opening the same equipment form).
  const alreadyRecorded = existing?.workflow_history?.some((h) => h.status === status);

  const workflow: LocalMaintenanceWorkflow = existing
    ? {
        ...existing,
        workflow_status: status,
        workflow_history: alreadyRecorded ? existing.workflow_history : [...existing.workflow_history, entry],
      }
    : {
        maintenance_id: maintenanceId,
        workflow_status: status,
        workflow_history: [entry],
      };

  await setLocalMaintenanceWorkflow(maintenanceId, workflow);
  return workflow;
}
