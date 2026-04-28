// services/refuelWorkflowAPI.ts
/**
 * Frontend service for the refueling workflow.
 * Maps to /api/refuel-workflow/* routes.
 */
import { api } from './api';

export const refuelWorkflowAPI = {

  /**
   * Start or resume a workflow record for a site.
   * Returns the FuelConsumption record — use `._id` as `workflowId` going forward.
   */
  start: (siteId: string, technicianId: string, taskId?: string) =>
    api.post('/refuel-workflow/start', { siteId, technicianId, taskId }),

  /**
   * Push an incremental workflow step (first-write-wins on backend).
   * @param workflowId  FuelConsumption._id
   * @param status      e.g. "activated" | "fuel_station" | "checked_in" | "form_opened" | "form_submitted" | "checked_out" | "completed"
   * @param meta        Optional step-specific data
   */
  updateStatus: (workflowId: string, status: string, meta?: Record<string, any>) =>
    api.patch(`/refuel-workflow/${workflowId}/status`, { status, meta }),

  /**
   * Fetch a single workflow record by its _id.
   */
  get: (workflowId: string) =>
    api.get(`/refuel-workflow/${workflowId}`),

  /**
   * Get the latest active (non-completed) workflow record for a site.
   */
  getActiveBySite: (siteId: string) =>
    api.get(`/refuel-workflow/site/${siteId}/active`),
};








// import { api } from "./api";

// export const refuelWorkflowAPI = {
//   // Start or resume a workflow
//   start: (siteId: string, technicianId: string, taskId?: string) =>
//     api.post("/refuel-workflow/start", { siteId, technicianId, taskId }),

//   // Update status (activation, check-in, form_opened, form_submitted, checked-out)
//   updateStatus: (workflowId: string, status: string, meta?: any) =>
//     api.post(`/refuel-workflow/${workflowId}/status`, { status, meta }),

//   // Get workflow (with history)
//   get: (workflowId: string) => api.get(`/refuel-workflow/${workflowId}`),
// };
