// hooks/useSyncCompletion.ts
//
// Fires `onComplete` whenever the offline sync queue finishes fully
// draining (transitions from having pending items to zero). Use this in
// any screen that shows server data so it refreshes automatically once
// whatever was queued while offline has synced -- without requiring the
// user to pull-to-refresh manually.

import { useEffect, useRef } from "react";
import { subscribeSync } from "../services/syncManager";

export function useSyncCompletion(onComplete: () => void) {
  const hadPending = useRef(false);
  const callbackRef = useRef(onComplete);
  callbackRef.current = onComplete;

  useEffect(() => {
    const unsubscribe = subscribeSync(({ pending, syncing }) => {
      if (pending > 0) {
        hadPending.current = true;
        return;
      }
      // pending is 0 -- only fire if we just transitioned down from having
      // pending items (not on initial mount when there was nothing queued).
      if (hadPending.current && !syncing) {
        hadPending.current = false;
        callbackRef.current();
      }
    });
    return unsubscribe;
  }, []);
}
