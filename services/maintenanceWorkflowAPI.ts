import { api } from "./api";

export const maintenanceWorkflowAPI = {
  /** Create a new workflow for a maintenance task */
  start: (maintenanceId: string, userId: string) =>
    api.post("/technician/maintenance-workflow/start", {
      maintenance_id: maintenanceId,
      technician_id: userId,
    }),

  /** Get active (non-completed) workflow for a maintenance task */
  getActiveByMaintenance: (maintenanceId: string) =>
    api.get(`/technician/maintenance-workflow/active/${maintenanceId}`),

  /** Get a specific workflow by ID */
  get: (workflowId: string) =>
    api.get(`/technician/maintenance-workflow/${workflowId}`),

  /** Patch a status step on the workflow */
  updateStatus: (
    workflowId: string,
    status: string,
    meta?: Record<string, any>
  ) =>
    api.patch(`/technician/maintenance-workflow/${workflowId}/status`, {
      status,
      meta,
    }),
};