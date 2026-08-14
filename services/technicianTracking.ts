// services/technicianTracking.ts
//
// Location sharing tied strictly to an active, checked-in job — this is
// NOT a background location service. It starts only when explicitly
// called at check-in, sends periodic pings while a workflow is active,
// and MUST be stopped at checkout or form submission. There is no
// ambient/always-on tracking anywhere in this file.
//
// The actual privacy enforcement lives on the backend (a ping is
// rejected unless it references a real, currently-active workflow owned
// by the calling technician — see routes/technicianTrackingRoutes.js).
// This client-side service is the sending half, not the guarantee.

import { getCurrentPosition } from './locationVerification';
import { api } from './api';

const PING_INTERVAL_MS = 90_000; // 90s — frequent enough to be useful on a live map, not a continuous trail

let pingTimer: ReturnType<typeof setInterval> | null = null;
let activeWorkflowId: string | null = null;

async function sendPing(workflowId: string) {
  const position = await getCurrentPosition();
  if (!position) return; // no GPS fix — skip this cycle silently, try again next interval
  try {
    await api.post('/technician-tracking/ping', {
      workflowId,
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
    });
  } catch (e) {
    // Non-fatal — a missed ping just means the manager's map shows a
    // slightly stale position until the next successful one, or the
    // ping ages out entirely after 20 minutes of failures. Never blocks
    // or interrupts the technician's actual work.
    console.warn('[technicianTracking] ping failed (non-fatal):', e);
  }
}

/** Call once, right after a successful check-in. Sends an immediate ping, then repeats every PING_INTERVAL_MS. */
export function startSharing(workflowId: string) {
  stopSharing(); // guard against a double-start leaving two intervals running
  activeWorkflowId = workflowId;
  void sendPing(workflowId);
  pingTimer = setInterval(() => {
    if (activeWorkflowId) void sendPing(activeWorkflowId);
  }, PING_INTERVAL_MS);
}

/** Call on checkout, form submission, logout, or app backgrounding for an extended period — stops pinging AND clears the last known position server-side immediately, rather than waiting up to 20 minutes for it to expire. */
export function stopSharing() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  activeWorkflowId = null;
  api.delete('/technician-tracking/ping').catch(() => {});
}

export function isSharing() {
  return activeWorkflowId !== null;
}
