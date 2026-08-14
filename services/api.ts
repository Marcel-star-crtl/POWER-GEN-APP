import axios from "axios";
import { authEvents } from "./authEvents";
import { secureAuthStorage } from "./secureAuthStorage";
import { isNetworkAvailable } from "../hooks/useNetworkStatus";

console.log("✅ api.ts loaded (uploader=fetch, offline-aware)");

// SERVER_URL is read from EXPO_PUBLIC_API_URL at build time (Expo inlines
// EXPO_PUBLIC_* vars automatically — no extra config needed). Falls back to
// the production API if the env var isn't set.
//
// PREVIOUSLY: this was hardcoded to a developer's personal LAN IP
// (192.168.1.137) with the production URL commented out above it — and
// since no build profile in eas.json injected any override, that exact
// same LAN-only address shipped in every build, including the production
// app-bundle. The app was unreachable for any user not on that specific
// developer's local WiFi network.
//
// For local development against a machine on your LAN, create a
// `.env.local` file (already gitignored — see .gitignore's `.env*.local`)
// with:
//   EXPO_PUBLIC_API_URL=http://<your-machine-LAN-IP>:5000
export const SERVER_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://powergen-api-wrr1.onrender.com";

console.log(
  process.env.EXPO_PUBLIC_API_URL
    ? `🌐 API target: ${SERVER_URL} (from EXPO_PUBLIC_API_URL)`
    : `🌐 API target: ${SERVER_URL} (default — set EXPO_PUBLIC_API_URL in .env.local to point at a different server, e.g. a local backend)`
);

const BASE_URL = `${SERVER_URL}/api`;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

api.interceptors.request.use(
  async (config) => {
    try {
      config.headers = config.headers ?? ({} as any);

      const token = await secureAuthStorage.getAccessToken();
      if (token) {
        const headers: any = config.headers;
        if (typeof headers.set === "function") {
          headers.set("Authorization", `Bearer ${token}`);
        } else {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const isFormData =
        typeof FormData !== "undefined" && config.data instanceof FormData;

      if (isFormData) {
        const headers: any = config.headers;
        if (typeof headers.delete === "function") headers.delete("Content-Type");
        else delete headers["Content-Type"];
      } else {
        const headers: any = config.headers;
        if (typeof headers.set === "function") headers.set("Content-Type", "application/json");
        else headers["Content-Type"] = "application/json";
      }
    } catch (error) {
      console.error("Error retrieving token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * Tries to recover from a 401 before giving up on the session:
 *  1. If a refresh token + /auth/refresh endpoint exist, use it.
 *  2. Otherwise, try a silent re-login with the credentials cached at last sign-in.
 * Returns true if the session was recovered (caller should retry the request).
 */
let recoveryInFlight: Promise<boolean> | null = null;

async function attemptSessionRecovery(): Promise<boolean> {
  if (recoveryInFlight) return recoveryInFlight;

  recoveryInFlight = (async () => {
    try {
      const refreshToken = await secureAuthStorage.getRefreshToken();
      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
          const newToken = res.data?.data?.accessToken || res.data?.accessToken;
          if (newToken) {
            await secureAuthStorage.updateAccessToken(newToken);
            return true;
          }
        } catch {
          // no refresh endpoint, or it rejected — fall through to silent re-login
        }
      }

      const creds = await secureAuthStorage.getCredentials();
      if (creds) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/login`, creds);
          const data = res.data?.data;
          if (data?.accessToken) {
            await secureAuthStorage.setSession(data.accessToken, data.user, data.refreshToken);
            return true;
          }
        } catch {
          // credentials no longer valid server-side — genuinely logged out
        }
      }

      return false;
    } finally {
      recoveryInFlight = null;
    }
  })();

  return recoveryInFlight;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original?._retried) {
      // If we're offline, a 401 is meaningless right now (it won't have come
      // from the server) — never log the user out for being offline.
      const online = await isNetworkAvailable();
      if (!online) return Promise.reject(error);

      const recovered = await attemptSessionRecovery();
      if (recovered && original) {
        original._retried = true;
        const token = await secureAuthStorage.getAccessToken();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return api.request(original);
      }

      // Truly unauthenticated — clear session and notify the app.
      await secureAuthStorage.clearSession();
      authEvents.emit();
    }
    return Promise.reject(error);
  },
);

// ============================================
// MAINTENANCE API
// ============================================

export const maintenanceAPI = {
  getTasks: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get("/maintenance", { params }),
  getTask: (id: string) => api.get(`/maintenance/${id}`),
  updateMaintenance: (id: string, data: any) => api.patch(`/maintenance/${id}`, data),
  updateEquipmentCheck: (maintenanceId: string, equipmentType: string, data: any) =>
    api.patch(`/maintenance/${maintenanceId}/equipment/${equipmentType}`, data),
  completeMaintenance: (id: string, data: any) => api.post(`/maintenance/${id}/complete`, data),
  saveDraft: (maintenanceId: string, data: any) => api.patch(`/maintenance/${maintenanceId}/draft`, data),
};

// ============================================
// SITE API
// ============================================

export const siteAPI = {
  getSiteDetails: (siteId: string) => api.get(`/sites/${siteId}`),
  getSiteEquipment: (siteId: string) => api.get(`/sites/${siteId}/equipment`),
  getSiteWithGenerators: (ihsIdSite: string) => api.get(`/sites/${ihsIdSite}`),
  getGenerator: (generatorId: string) => api.get(`/generators/${generatorId}`),
};

// ============================================
// OPERATIONS API (Site Audits)
// ============================================

export const operationsAPI = {
  getSites: () => api.get("/operations/sites"),
  listAudits: (params?: { status?: string; siteId?: string; page?: number; limit?: number }) =>
    api.get("/operations/audits", { params }),
  getAudit: (id: string) => api.get(`/operations/audits/${id}`),
  createAudit: (data: any) => api.post("/operations/audits", data),
  updateAudit: (id: string, data: any) => api.put(`/operations/audits/${id}`, data),
  updateAuditStatus: (id: string, status: string) =>
    api.patch(`/operations/audits/${id}/status`, { status }),
};

// ============================================
// FILE UPLOAD API
// ============================================

export const uploadAPI = {
  uploadEndpoint: `${SERVER_URL}/api/upload`,

  uploadFormData: async (formData: FormData) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const token = await secureAuthStorage.getAccessToken();
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `${SERVER_URL}/api/upload`;
    const maxRetries = 2;

    console.log("⬆️ uploadFormData(fetch):", {
      url,
      hasToken: Boolean(token),
      maxRetries,
    });

    // IMPORTANT: do NOT set Content-Type for multipart; fetch will add boundary.
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: formData as any,
        });

        const raw = await res.text();
        let data: any;
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { raw };
        }

        if (!res.ok) {
          const serverMessage =
            data?.message ||
            data?.error ||
            (typeof raw === "string" && raw) ||
            undefined;

          // Retry transient server responses, including upstream timeouts
          // (e.g. a slow Cloudinary upload) if your /api/upload route
          // forwards that status code literally.
          if (
            (res.status >= 500 || res.status === 429 || res.status === 408 || res.status === 499) &&
            attempt < maxRetries
          ) {
            const backoff = 400 * Math.pow(2, attempt);
            console.warn(
              `⚠️ Upload transient failure (${res.status}). Retrying in ${backoff}ms...`,
            );
            await sleep(backoff);
            continue;
          }

          throw new Error(
            `Upload failed (${res.status}): ${serverMessage || res.statusText || "Unknown error"}`,
          );
        }

        // Small pacing helps avoid back-to-back multipart bursts on mobile networks.
        await sleep(150);

        // Mimic axios response shape where we rely on `.data`.
        return { status: res.status, data };
      } catch (err: any) {
        const message = err?.message || String(err);
        const isNetworkError = /network request failed/i.test(message);

        if (isNetworkError && attempt < maxRetries) {
          const backoff = 500 * Math.pow(2, attempt);
          console.warn(`⚠️ Upload network error. Retrying in ${backoff}ms...`);
          await sleep(backoff);
          continue;
        }

        throw err;
      }
    }

    // Unreachable, but keeps TS happy.
    throw new Error("Upload failed: exhausted retries");
  },

  // Upload photo/file
  uploadFile: async (file: { uri: string; type: string; name: string }) => {
    const formData = new FormData();

    // React Native requires this specific format
    formData.append("file", {
      uri: file.uri,
      type: file.type || "image/jpeg",
      name: file.name || "photo.jpg",
    } as any);

    return uploadAPI.uploadFormData(formData);
  },

  // Upload multiple files
  uploadMultiple: async (
    files: { uri: string; type: string; name: string }[],
  ) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", {
        uri: file.uri,
        type: file.type,
        name: file.name,
      } as any);
    });

    // Don't set Content-Type header - let React Native handle it
    return api.post("/upload/multiple", formData);
  },

  // Recursively find and upload images in a data object
  processAndUploadData: async (data: any): Promise<any> => {
    const inferImageMimeType = (
      nameOrUri?: string,
      fallback: string = "image/jpeg",
    ) => {
      const s = (nameOrUri || "").toLowerCase();
      if (s.endsWith(".png")) return "image/png";
      if (s.endsWith(".webp")) return "image/webp";
      if (s.endsWith(".gif")) return "image/gif";
      if (s.endsWith(".bmp")) return "image/bmp";
      if (s.endsWith(".jpg") || s.endsWith(".jpeg")) return "image/jpeg";
      return fallback;
    };

    const normalizeMimeType = (maybe: any, nameOrUri?: string) => {
      // expo-image-picker often gives "image"; server expects a real mime type.
      if (typeof maybe === "string" && maybe.includes("/")) return maybe;
      return inferImageMimeType(nameOrUri, "image/jpeg");
    };

    const processRecursive = async (obj: any): Promise<any> => {
      if (!obj) return obj;

      // Support plain string URIs inside arrays/objects
      if (
        typeof obj === "string" &&
        (obj.startsWith("file://") || obj.startsWith("content://"))
      ) {
        const uri = obj;
        const inferredName = uri.split("/").pop() || `photo_${Date.now()}.jpg`;
        const inferredType = inferImageMimeType(inferredName, "image/jpeg");

        console.log("⬆️ Uploading photo (string uri):", uri);

        const formData = new FormData();
        formData.append("file", {
          uri,
          type: inferredType,
          name: inferredName,
        } as any);

        const uploadRes = await uploadAPI.uploadFormData(formData);
        if (uploadRes?.data?.url) {
          console.log("✅ Upload success:", uploadRes.data.url);
          return uploadRes.data.url;
        }

        throw new Error("Upload succeeded but no URL returned");
      }

      // Check if object is a local photo attachment
      if (
        obj.uri &&
        typeof obj.uri === "string" &&
        (obj.uri.startsWith("file://") || obj.uri.startsWith("content://"))
      ) {
        try {
          console.log("⬆️ Uploading photo:", obj.uri);

          const formData = new FormData();
          formData.append("file", {
            uri: obj.uri,
            type: normalizeMimeType(obj.type, obj.name || obj.uri),
            name:
              obj.name || obj.uri.split("/").pop() || `photo_${Date.now()}.jpg`,
          } as any);

          const uploadRes = await uploadAPI.uploadFormData(formData);

          if (uploadRes.data && uploadRes.data.url) {
            console.log("✅ Upload success:", uploadRes.data.url);
            return { ...obj, uri: uploadRes.data.url };
          } else {
            throw new Error("Upload succeeded but no URL returned");
          }
        } catch (err: any) {
          const status = err?.response?.status;
          const responseData = err?.response?.data;

          console.error("❌ Failed to upload photo:", {
            uri: obj.uri,
            message: err?.message,
            status,
            responseData,
          });

          const serverMessage =
            (typeof responseData === "string" && responseData) ||
            responseData?.error ||
            responseData?.message ||
            undefined;
          throw new Error(
            `Image upload failed${status ? ` (${status})` : ""}: ${serverMessage || err?.message || "Unknown error"}`,
          );
        }
      }

      if (Array.isArray(obj)) {
        // Upload sequentially to avoid multiple concurrent multipart requests.
        const result: any[] = [];
        for (const item of obj) {
          result.push(await processRecursive(item));
        }
        return result;
      }

      if (typeof obj === "object") {
        const newObj: any = {};
        const keys = Object.keys(obj);
        const values = await Promise.all(
          keys.map((key) => processRecursive(obj[key])),
        );
        keys.forEach((key, i) => {
          newObj[key] = values[i];
        });
        return newObj;
      }

      return obj;
    };

    return processRecursive(data);
  },
};

