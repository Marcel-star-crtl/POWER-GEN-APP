// services/offlineMaintenanceWorkflow.ts
//
// Replaces direct maintenanceWorkflowAPI calls in the maintenance-flow
// screens. Same principle as offlineWorkflow.ts (refueling): a workflow
// progresses through its local cache first -- ALWAYS succeeds, online or
// offline -- and is mirrored to the server via the same sync queue
// everything else uses. No screen should ever be blocked, or show an
// error and back the user out, just because there's no connection.
//
// Simpler than the refuel version: `workflowId === maintenanceId` always
// (a real, pre-existing server ID from when the task was scheduled), so
// there's no client-id resolution scheme needed -- every queued PATCH can
// target the real endpoint directly regardless of connectivity at the
// time it was queued.

import { maintenanceWorkflowAPI } from "./maintenanceWorkflowAPI";
import { isNetworkAvailable } from "../hooks/useNetworkStatus";
import { submitOrQueue } from "./offlineApi";
import {
  appendLocalMaintenanceStatus,
  getLocalMaintenanceWorkflow,
  setLocalMaintenanceWorkflow,
  LocalMaintenanceWorkflow,
} from "../lib/maintenanceWorkflowCache";

export interface MaintenanceWorkflowResult {
  workflowId: string; // always === maintenanceId
  workflow: LocalMaintenanceWorkflow;
}

/**
 * Activate (or resume) the workflow for a maintenance task. Never throws
 * for connectivity reasons -- online, it tries to find/create the real
 * server-side workflow state; offline (or if that attempt fails for any
 * reason), it works entirely from the local cache and queues the server
 * side for later.
 */
export async function activateMaintenanceWorkflow(
  maintenanceId: string,
  technicianId: string,
): Promise<MaintenanceWorkflowResult> {
  const online = await isNetworkAvailable();

  if (online) {
    try {
      const activeRes = await maintenanceWorkflowAPI.getActiveByMaintenance(maintenanceId);
      const activeRecord = activeRes.data?.data ?? null;

      if (!activeRecord) {
        await maintenanceWorkflowAPI.start(maintenanceId, technicianId);
      }

      await maintenanceWorkflowAPI.updateStatus(maintenanceId, "activated", {
        activatedAt: new Date().toISOString(),
        technicianId,
      });

      let workflow = await appendLocalMaintenanceStatus(maintenanceId, "activated", { technicianId });

      // Fold in whatever server history already existed (resume case) so
      // the local cache reflects the full picture, not just this session.
      if (activeRecord?.workflow_history) {
        workflow = {
          ...workflow,
          workflow_status: activeRecord.workflow_status ?? workflow.workflow_status,
          workflow_history: mergeHistories(activeRecord.workflow_history, workflow.workflow_history),
        };
        await setLocalMaintenanceWorkflow(maintenanceId, workflow);
      }

      return { workflowId: maintenanceId, workflow };
    } catch {
      // fall through to offline path below
    }
  }

  // ── Offline (or the online attempt failed) ────────────────────────────────
  const existingLocal = await getLocalMaintenanceWorkflow(maintenanceId);
  const workflow = await appendLocalMaintenanceStatus(
    maintenanceId,
    existingLocal?.workflow_status && existingLocal.workflow_status !== ""
      ? existingLocal.workflow_status // resuming a workflow already in progress locally
      : "activated",
    { technicianId },
  );

  if (!existingLocal) {
    // Only queue a "start" once per workflow lifetime -- both calls are
    // idempotent server-side regardless, but no point queueing twice.
    await submitOrQueue(
      "maintenance_workflow_start",
      "/technician/maintenance-workflow/start",
      "POST",
      { maintenance_id: maintenanceId, technician_id: technicianId },
    );
  }
  await submitOrQueue(
    "maintenance_workflow_status",
    `/technician/maintenance-workflow/${maintenanceId}/status`,
    "PATCH",
    { status: "activated", meta: { activatedAt: new Date().toISOString(), technicianId } },
  );

  return { workflowId: maintenanceId, workflow };
}

/**
 * Patch a status step. Always updates the local cache immediately (so the
 * UI can proceed) and queues the server PATCH against the real endpoint --
 * no client-id resolution needed since maintenanceId is always the real ID.
 */
export async function patchMaintenanceWorkflowStatus(
  maintenanceId: string,
  status: string,
  meta?: any,
): Promise<LocalMaintenanceWorkflow> {
  const workflow = await appendLocalMaintenanceStatus(maintenanceId, status, meta);

  await submitOrQueue(
    "maintenance_workflow_status",
    `/technician/maintenance-workflow/${maintenanceId}/status`,
    "PATCH",
    { status, meta },
  );

  return workflow;
}

/** Read the current local workflow state for a maintenance task -- what every screen should render from. */
export async function getMaintenanceWorkflow(maintenanceId: string): Promise<LocalMaintenanceWorkflow | null> {
  return getLocalMaintenanceWorkflow(maintenanceId);
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
