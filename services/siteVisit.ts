import { api } from "./api";

type VisitData = {
  site_id: string;
  site_name?: string;
  maintenance_id?: string;
  maintenanceId?: string;
  check_in_time?: string;
  status?: string;
};

export const getCurrentVisit = async (): Promise<VisitData | null> => {
  const response = await api.get("/technician/visit/current");
  return response.data?.data || null;
};

export const checkInSite = async (payload: {
  siteId: string;
  siteName?: string;
  maintenanceId?: string;
}) => {
  return api.post("/technician/visit/check-in", {
    site_id: payload.siteId,
    site_name: payload.siteName,
    ...(payload.maintenanceId ? { maintenanceId: payload.maintenanceId } : {}),
  });
};

export const checkOutSite = async (payload?: { notes?: string }) => {
  return api.post("/technician/visit/check-out", {
    ...(payload?.notes ? { notes: payload.notes } : {}),
  });
};
