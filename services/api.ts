import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { authEvents } from './authEvents';

console.log('✅ api.ts loaded (uploader=fetch)');

export const SERVER_URL = 'http://192.168.16.29:5000'; // Updated to current local IP
const BASE_URL = `${SERVER_URL}/api`;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // Increased timeout for file uploads
  // Don't set default Content-Type - let each request set its own
});

api.interceptors.request.use(
  async (config) => {
    try {
      // Axios may create requests without an explicit headers object.
      // Ensure it exists before we mutate it.
      config.headers = config.headers ?? ({} as any);

      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        const headers: any = config.headers;
        if (typeof headers.set === 'function') {
          headers.set('Authorization', `Bearer ${token}`);
        } else {
          headers.Authorization = `Bearer ${token}`;
        }
        console.log('🔑 Request with token:', config.url);
      } else {
        console.log('⚠️ No token found for request:', config.url);
      }
      
      const isFormData =
        typeof FormData !== 'undefined' && config.data instanceof FormData;

      // Set Content-Type for JSON requests only (never for FormData)
      if (isFormData) {
        const headers: any = config.headers;
        if (typeof headers.delete === 'function') {
          headers.delete('Content-Type');
        } else {
          delete headers['Content-Type'];
        }
      } else {
        const headers: any = config.headers;
        if (typeof headers.set === 'function') {
          headers.set('Content-Type', 'application/json');
        } else {
          headers['Content-Type'] = 'application/json';
        }
      }

      // Small targeted debug for uploads.
      if (config.url && config.url.includes('/upload')) {
        const headers: any = config.headers;
        const contentType = typeof headers.get === 'function' ? headers.get('Content-Type') : headers['Content-Type'];
        console.log('⬆️ Upload request debug:', {
          url: config.url,
          isFormData,
          contentType,
        });
      }
    } catch (error) {
      console.error('Error retrieving token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle token expiration/unauthorized
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('user');
      authEvents.emit(); // Notify AuthContext to update state
    }
    return Promise.reject(error);
  }
);

// ============================================
// MAINTENANCE API
// ============================================

export const maintenanceAPI = {
  // Get maintenance tasks for technician
  getTasks: (params?: { status?: string; page?: number; limit?: number }) => 
    api.get('/maintenance', { params }),
  
  // Get single maintenance/task details
  getTask: (id: string) => 
    api.get(`/maintenance/${id}`),
  
  // Update maintenance record
  updateMaintenance: (id: string, data: any) => 
    api.patch(`/maintenance/${id}`, data),
  
  // Update equipment check data
  updateEquipmentCheck: (maintenanceId: string, equipmentType: string, data: any) => 
    api.patch(`/maintenance/${maintenanceId}/equipment/${equipmentType}`, data),
  
  // Complete maintenance visit
  completeMaintenance: (id: string, data: any) => 
    api.post(`/maintenance/${id}/complete`, data),
  
  // Save draft
  saveDraft: (maintenanceId: string, data: any) => 
    api.patch(`/maintenance/${maintenanceId}/draft`, data),
};

// ============================================
// SITE API
// ============================================

export const siteAPI = {
  // Get site details including equipment and generators
  getSiteDetails: (siteId: string) => 
    api.get(`/sites/${siteId}`),
  
  // Get site equipment list
  getSiteEquipment: (siteId: string) => 
    api.get(`/sites/${siteId}/equipment`),
  
  // Get site with generators by IHS_ID_SITE (site ID)
  getSiteWithGenerators: (ihsIdSite: string) => 
    api.get(`/sites/${ihsIdSite}`),
  
  // Get specific generator details
  getGenerator: (generatorId: string) => 
    api.get(`/generators/${generatorId}`),
};

// ============================================
// FILE UPLOAD API
// ============================================

export const uploadAPI = {
  uploadEndpoint: `${SERVER_URL}/api/upload`,

  uploadFormData: async (formData: FormData) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const token = await AsyncStorage.getItem('accessToken');
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `${SERVER_URL}/api/upload`;
    const maxRetries = 2;

    console.log('⬆️ uploadFormData(fetch):', {
      url,
      hasToken: Boolean(token),
      maxRetries,
    });

    // IMPORTANT: do NOT set Content-Type for multipart; fetch will add boundary.
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
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
            data?.message || data?.error || (typeof raw === 'string' && raw) || undefined;

          // Retry transient server responses.
          if ((res.status >= 500 || res.status === 429) && attempt < maxRetries) {
            const backoff = 400 * Math.pow(2, attempt);
            console.warn(`⚠️ Upload transient failure (${res.status}). Retrying in ${backoff}ms...`);
            await sleep(backoff);
            continue;
          }

          throw new Error(
            `Upload failed (${res.status}): ${serverMessage || res.statusText || 'Unknown error'}`
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
    throw new Error('Upload failed: exhausted retries');
  },

  // Upload photo/file
  uploadFile: async (file: { uri: string; type: string; name: string }) => {
    const formData = new FormData();
    
    // React Native requires this specific format
    formData.append('file', {
      uri: file.uri,
      type: file.type || 'image/jpeg',
      name: file.name || 'photo.jpg',
    } as any);
    
    return uploadAPI.uploadFormData(formData);
  },
  
  // Upload multiple files
  uploadMultiple: async (files: Array<{ uri: string; type: string; name: string }>) => {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append('files', {
        uri: file.uri,
        type: file.type,
        name: file.name,
      } as any);
    });
    
    // Don't set Content-Type header - let React Native handle it
    return api.post('/upload/multiple', formData);
  },

  // Recursively find and upload images in a data object
  processAndUploadData: async (data: any): Promise<any> => {
    const inferImageMimeType = (nameOrUri?: string, fallback: string = 'image/jpeg') => {
      const s = (nameOrUri || '').toLowerCase();
      if (s.endsWith('.png')) return 'image/png';
      if (s.endsWith('.webp')) return 'image/webp';
      if (s.endsWith('.gif')) return 'image/gif';
      if (s.endsWith('.bmp')) return 'image/bmp';
      if (s.endsWith('.jpg') || s.endsWith('.jpeg')) return 'image/jpeg';
      return fallback;
    };

    const normalizeMimeType = (maybe: any, nameOrUri?: string) => {
      // expo-image-picker often gives "image"; server expects a real mime type.
      if (typeof maybe === 'string' && maybe.includes('/')) return maybe;
      return inferImageMimeType(nameOrUri, 'image/jpeg');
    };

    const processRecursive = async (obj: any): Promise<any> => {
        if (!obj) return obj;

        // Support plain string URIs inside arrays/objects
        if (
          typeof obj === 'string' &&
          (obj.startsWith('file://') || obj.startsWith('content://'))
        ) {
          const uri = obj;
          const inferredName = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
          const inferredType = inferImageMimeType(inferredName, 'image/jpeg');

          console.log('⬆️ Uploading photo (string uri):', uri);

          const formData = new FormData();
          formData.append('file', {
            uri,
            type: inferredType,
            name: inferredName,
          } as any);

          const uploadRes = await uploadAPI.uploadFormData(formData);
          if (uploadRes?.data?.url) {
            console.log('✅ Upload success:', uploadRes.data.url);
            return uploadRes.data.url;
          }

          throw new Error('Upload succeeded but no URL returned');
        }

        // Check if object is a local photo attachment
        if (obj.uri && typeof obj.uri === 'string' && (obj.uri.startsWith('file://') || obj.uri.startsWith('content://'))) {
             try {
                console.log('⬆️ Uploading photo:', obj.uri);
                
                // Direct upload - create FormData properly for React Native
                const formData = new FormData();
                formData.append('file', {
                    uri: obj.uri,
                  type: normalizeMimeType(obj.type, obj.name || obj.uri),
                  name: obj.name || obj.uri.split('/').pop() || `photo_${Date.now()}.jpg`
                } as any);

                console.log('⬆️ Upload payload:', {
                  uri: obj.uri,
                  type: normalizeMimeType(obj.type, obj.name || obj.uri),
                  name: obj.name || 'auto',
                });
                
                const uploadRes = await uploadAPI.uploadFormData(formData);
                
                if (uploadRes.data && uploadRes.data.url) {
                    console.log('✅ Upload success:', uploadRes.data.url);
                    return { ...obj, uri: uploadRes.data.url };
                } else {
                    throw new Error('Upload succeeded but no URL returned');
                }
             } catch (err: any) {
                 const status = err?.response?.status;
                 const responseData = err?.response?.data;

                 console.error('❌ Failed to upload photo:', {
                   uri: obj.uri,
                   message: err?.message,
                   status,
                   responseData,
                 });

                 // Throw error to prevent saving invalid file:// URIs
                 const serverMessage =
                   (typeof responseData === 'string' && responseData) ||
                   responseData?.error ||
                   responseData?.message ||
                   undefined;
                 throw new Error(
                   `Image upload failed${status ? ` (${status})` : ''}: ${serverMessage || err?.message || 'Unknown error'}`
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

        if (typeof obj === 'object') {
            const newObj: any = {};
            const keys = Object.keys(obj);
            const values = await Promise.all(keys.map(key => processRecursive(obj[key])));
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

