// hooks/useNetworkStatus.ts
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export function useNetworkStatus() {
  // Assume online until proven otherwise, to avoid a flash of "offline" UI on boot
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable can be null while NetInfo is still figuring it out;
      // treat null as "assume online" to avoid false negatives, but isConnected=false is definitive.
      const online = state.isConnected && state.isInternetReachable !== false;
      setIsOnline(!!online);
    });
    return () => unsubscribe();
  }, []);

  return isOnline;
}

/** One-off check, useful outside React components (e.g. inside services). */
export async function isNetworkAvailable(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable !== false);
}
