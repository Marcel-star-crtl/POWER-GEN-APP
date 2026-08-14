// services/offlineWorkflow.ts
//
// Replaces direct refuelWorkflowAPI calls in the refueling flow screens.
// A workflow now progresses through its local cache first -- ALWAYS
// succeeds, online or offline -- and is mirrored to the server in the
// background via the same sync queue everything else uses. No screen in
// the refuel flow should ever be blocked, or show an error and back the
// user out, just because there's no connection.

import { refuelWorkflowAPI } from "./refuelWorkflowAPI";
import { isNetworkAvailable } from "../hooks/useNetworkStatus";
import { submitOrQueue, generateClientId } from "./offlineApi";
import {
  appendLocalStatus,
  getLocalWorkflow,
  LocalWorkflow,
} from "../lib/workflowCache";

export interface WorkflowResult {
  workflowId: string; // real server _id if known, else a stable local placeholder
  workflowClientId: string; // always present -- generated locally, used to resolve server-side once synced
  workflow: LocalWorkflow;
  isLocalOnly: boolean; // true if this workflow hasn't been created on the server yet
}

/**
 * Activate (or resume) the refuel workflow for a site. Never throws for
 * connectivity reasons -- online, it tries to find/create the real server
 * record; offline, it works entirely from the local cache and queues the
 * server-side creation for later.
 */
export async function activateWorkflow(
  siteId: string,
  technicianId: string,
  maintenanceId?: string,
): Promise<WorkflowResult> {
  const existingLocal = await getLocalWorkflow(siteId);

  // Reuse the same client id across the whole local workflow lifetime so
  // every queued status patch resolves to the same eventual server record.
  const workflowClientId = existingLocal?._id?.startsWith("local:")
    ? existingLocal._id
    : existingLocal?.workflow_history?.[0]?.meta?.clientId || `local:${generateClientId()}`;

  const online = await isNetworkAvailable();

  if (online) {
    try {
      // Try to find an existing server-side workflow for this site first.
      const activeRes = await refuelWorkflowAPI.getActiveBySite(siteId);
      const activeRecord = activeRes.data?.data ?? null;

      let workflowId: string;
      let currentStatus: string;

      if (activeRecord) {
        workflowId = String(activeRecord._id);
        currentStatus = activeRecord.workflow_status ?? "initiated";
      } else {
        const startRes = await refuelWorkflowAPI.start(siteId, technicianId, maintenanceId);
        workflowId = String(
          startRes.data.data?._id ?? startRes.data.data?.id ?? startRes.data._id ?? startRes.data.id ?? "",
        );
        currentStatus = startRes.data.data?.workflow_status ?? startRes.data.workflow_status ?? "initiated";
      }

      if (workflowId && workflowId !== "undefined" && workflowId !== "null") {
        await refuelWorkflowAPI.updateStatus(workflowId, "activated", {
          activatedAt: new Date().toISOString(),
          technicianId,
        });

        const workflow = await appendLocalStatus(siteId, "activated", { technicianId }, workflowId);
        // Also fold in whatever server history already existed (resume case)
        if (activeRecord?.workflow_history) {
          workflow.workflow_history = mergeHistories(activeRecord.workflow_history, workflow.workflow_history);
          workflow.workflow_status = currentStatus;
        }
        return { workflowId, workflowClientId, workflow, isLocalOnly: false };
      }
    } catch {
      // fall through to offline path below
    }
  }

  // ── Offline (or the online attempt failed) ────────────────────────────────
  // Work entirely from the local cache. Queue the server-side "start" so it
  // creates the real record once connectivity returns.
  const localId = existingLocal?._id || `local:${workflowClientId}`;
  const workflow = await appendLocalStatus(
    siteId,
    existingLocal?.workflow_status && existingLocal.workflow_status !== ""
      ? existingLocal.workflow_status // resuming a workflow already in progress locally
      : "activated",
    { technicianId, clientId: workflowClientId },
    localId,
  );

  if (!existingLocal || existingLocal.workflow_status === "") {
    // Only queue a "start" once per workflow lifetime.
    await submitOrQueue(
      "refuel_workflow_start",
      "/refuel-workflow/start",
      "POST",
      { siteId, technicianId, taskId: maintenanceId, client_id: workflowClientId },
    );
  }

  return { workflowId: localId, workflowClientId, workflow, isLocalOnly: true };
}

/**
 * Patch a status step. Always updates the local cache immediately (so the
 * UI can proceed) and queues the server PATCH -- resolved by either the
 * real workflowId (if known) or workflowClientId (if this workflow was
 * created offline and hasn't synced yet).
 */
export async function patchWorkflowStatus(
  siteId: string,
  workflowId: string,
  workflowClientId: string,
  status: string,
  meta?: any,
): Promise<LocalWorkflow> {
  const workflow = await appendLocalStatus(siteId, status, meta, workflowId);

  const isLocalOnly = workflowId.startsWith("local:");
  await submitOrQueue(
    "refuel_workflow_status",
    isLocalOnly
      ? `/refuel-workflow/by-client/${workflowClientId}/status`
      : `/refuel-workflow/${workflowId}/status`,
    "PATCH",
    { status, meta, client_id: workflowClientId },
  );

  return workflow;
}

/** Read the current local workflow state for a site -- what every screen should render from. */
export async function getWorkflow(siteId: string): Promise<LocalWorkflow | null> {
  return getLocalWorkflow(siteId);
}

function mergeHistories(
  serverHistory: { status: string; timestamp: string; meta?: any }[],
  localHistory: { status: string; timestamp: string; meta?: any }[],
) {
  const seen = new Set<string>();
  const merged = [...serverHistory, ...localHistory].filter((h) => {
    if (seen.has(h.status)) return false;
    seen.add(h.status);
    return true;
  });
  return merged;
}
