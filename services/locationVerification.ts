// services/locationVerification.ts
//
// GPS-based "am I actually at this site?" verification, used at the
// refueling check-in step. Talks to POST /sites-map/verify-location on
// the backend (see routes/sitesMapRoutes.js), which compares the
// technician's current position against the target site's stored
// coordinates and geofence radius.

import * as Location from 'expo-location';
import { api } from './api';

export interface GeofenceVerification {
  verifiable: boolean;
  isInside?: boolean;
  distanceMeters?: number;
  radiusMeters?: number;
  reason?: string;
  site_id: string;
  site_name?: string;
}

export interface CurrentPosition {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

/**
 * Requests foreground location permission if not already granted.
 * Returns true if permission is granted (now or previously), false if denied.
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function hasLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Gets the device's current GPS position. Returns null if permission
 * isn't granted or the device can't produce a fix (e.g. GPS disabled,
 * indoors with no signal) — callers should treat null as "couldn't
 * verify" rather than throwing, since a technician's work shouldn't be
 * blocked by a GPS hiccup.
 */
export async function getCurrentPosition(): Promise<CurrentPosition | null> {
  try {
    const granted = await hasLocationPermission() || await requestLocationPermission();
    if (!granted) return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitude:  loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy:  loc.coords.accuracy,
    };
  } catch (e) {
    console.warn('[locationVerification] getCurrentPosition failed:', e);
    return null;
  }
}

/**
 * Verifies the device's current position against a site's geofence.
 * Never throws — a verification failure (no GPS, no network, site has no
 * coordinates) returns verifiable:false with a human-readable reason,
 * never blocks the technician from proceeding on its own. The UI decides
 * what to do with an "outside geofence" result (warn, not necessarily block).
 */
export async function verifySiteLocation(site_id: string): Promise<GeofenceVerification> {
  const position = await getCurrentPosition();
  if (!position) {
    return {
      verifiable: false,
      reason: 'Could not get your current location. Check that location services are enabled.',
      site_id,
    };
  }

  try {
    const res = await api.post('/sites-map/verify-location', {
      site_id,
      latitude:  position.latitude,
      longitude: position.longitude,
    });
    return res.data?.data ?? { verifiable: false, reason: 'Unexpected response from server', site_id };
  } catch (e: any) {
    // Network/server issue — distinct reason from "no GPS", still non-blocking.
    return {
      verifiable: false,
      reason: e?.response?.data?.error || 'Could not reach the server to verify your location.',
      site_id,
    };
  }
}
