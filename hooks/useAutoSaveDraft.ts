// hooks/useAutoSaveDraft.ts
//
// Periodic, silent local draft autosave — closes the "Implement auto-save
// logic (every 2 min)" gap from TECHNICIAN_APP_PLAN.md. Before this, every
// long multi-section form (HSE inspection, Tank Audit, Site Audit, Refueling)
// only persisted a draft when the technician explicitly tapped "Save Draft" —
// if the app was killed, the device lost power, or they simply forgot, all
// in-progress field entries were lost.
//
// This hook does NOT replace the existing "Save Draft" button or its network
// sync — it only repeats the LOCAL half of what that button already does
// (writing the current form state to the same on-device draft cache the
// screen already reads from on mount), on a timer, with no network call and
// no confirmation alert. It's meant to be invisible unless it's the only
// thing standing between a technician and losing 20 minutes of fieldwork.
//
// Usage:
//   const autoSaveLocalDraft = useCallback(async () => { ...write draftKey... }, [...]);
//   useAutoSaveDraft(autoSaveLocalDraft, { enabled: !loading });
import { useEffect, useRef } from "react";

export interface UseAutoSaveDraftOptions {
  /** Default: 2 minutes, per the plan doc. */
  intervalMs?: number;
  /**
   * Gate autosave off (e.g. while the initial draft/site data is still
   * loading, or while a submit is in flight) without tearing down and
   * recreating the underlying interval.
   */
  enabled?: boolean;
}

export function useAutoSaveDraft(
  saveFn: () => void | Promise<void>,
  options?: UseAutoSaveDraftOptions,
): void {
  const intervalMs = options?.intervalMs ?? 2 * 60 * 1000;
  const enabled = options?.enabled ?? true;

  // Refs so the interval callback always sees the LATEST saveFn/enabled
  // without needing saveFn or enabled in the effect's dependency array —
  // recreating the interval on every render (e.g. every keystroke, since
  // saveFn usually closes over form state) would mean it never fires.
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const id = setInterval(() => {
      if (!enabledRef.current) return;
      Promise.resolve(saveFnRef.current()).catch((err) => {
        console.warn("[useAutoSaveDraft] periodic autosave failed:", err);
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
