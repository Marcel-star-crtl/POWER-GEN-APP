// export const isTechnicianRole = (role?: string | null) =>
//   role === "technician" || role === "ac" || role === "data_collector";

// export const isRestrictedAcScopeRole = (role?: string | null) =>
//   role === "ac" || role === "data_collector";

export const isTechnicianRole = (role?: string | null) =>
  role === "technician" ||
  role === "ac" ||
  role === "data_collector" ||
  role === "fuel";

export const isRestrictedAcScopeRole = (role?: string | null) =>
  role === "ac" || role === "data_collector";

export const isFuelRole = (role?: string | null) => role === "fuel";
