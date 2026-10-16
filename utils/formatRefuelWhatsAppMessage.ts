// utils/formatRefuelWhatsAppMessage.ts
//
// Builds the exact plain-text report technicians share to a WhatsApp
// group right after submitting a refueling visit. The field labels,
// order, and shape below intentionally match the format GRATO asked
// for verbatim (including the "Jauge avant" / "Fond cubi" / "Planifier"
// wording) — do not "clean up" the wording without checking with them
// first, a WhatsApp group full of technicians is already trained to
// read reports in this exact shape.
//
// Kept as a pure function (no React, no I/O, no device APIs) so it's
// trivial to reuse from both the live post-submit popup
// (components/ui/WhatsAppSharePopup.tsx) and the "share later" queue's
// re-open flow (app/(technician)/pending-whatsapp-shares.tsx) without
// re-deriving the text differently in two places.

export interface RefuelShareData {
  site_id: string;
  site_name: string;
  fse_name: string;
  tank_type?: string | null;
  tank_length_cm?: string | number | null;
  tank_height_cm?: string | number | null;
  tank_width_cm?: string | number | null;
  tank_observations?: string | null;
  fuel_sensor_status?: string | null;
  dip_stick_before_cm?: string | number | null;
  dip_stick_after_cm?: string | number | null;
  truck_flow_meter_before_l?: string | number | null;
  truck_flow_meter_after_l?: string | number | null;
  truck_plate_number?: string | null;
  guard_name?: string | null;
  guard_number?: string | null;
  // The current generator meter reading — this is what "Gen running
  // hour:17064" in the sample format is: the hour-meter photo's own
  // caption value, not a separate field. See
  // components/ui/WhatsAppSharePopup.tsx for why the three picture
  // *categories* here (Gen running hour / Tank Refueling action / Site
  // plate) are fixed boilerplate rather than per-photo labels — the
  // form doesn't tag individual photos by category today.
  gen_running_hour?: string | number | null;
  photo_count: number;
  // DD/MM/YYYY — already formatted by the caller (see toDDMMYYYY below).
  refuel_start_date: string;
  refuel_start_time?: string | null; // HH:mm
  refuel_end_date: string;
  refuel_end_time?: string | null; // HH:mm
  date_planned: string; // DD/MM/YYYY
}

const dash = (v?: string | number | null): string => {
  if (v === null || v === undefined) return "-";
  const s = String(v).trim();
  return s === "" ? "-" : s;
};

/** "2026-09-05" -> "05/09/2026". Passes through anything that isn't a
 * clean YYYY-MM-DD (e.g. already-formatted or missing) unchanged. */
export function toDDMMYYYY(yyyyMmDd?: string | null): string {
  if (!yyyyMmDd) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(yyyyMmDd);
  if (!m) return yyyyMmDd;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

export function buildRefuelWhatsAppMessage(d: RefuelShareData): string {
  const guardAvailable = d.guard_name || d.guard_number ? "Yes" : "No";
  const photoNote =
    d.photo_count > 0
      ? ` (${d.photo_count} photo${d.photo_count === 1 ? "" : "s"} attached below)`
      : " (no photos attached)";

  const lines = [
    `Site ID: ${dash(d.site_id)}`,
    `Site name: ${dash(d.site_name)}`,
    `FSE name: ${dash(d.fse_name)}`,
    `Tank Type: ${dash(d.tank_type)}`,
    `Tank Length (cm): ${dash(d.tank_length_cm)}`,
    `Tank Height (cm): ${dash(d.tank_height_cm)}`,
    `Tank Width (cm): ${dash(d.tank_width_cm)}`,
    `Tank Observations: ${dash(d.tank_observations)}`,
    `Fuel sensor status: ${dash(d.fuel_sensor_status)}`,
    `Dip Stick Measurement Before Jauge avant: ${dash(d.dip_stick_before_cm)}cm`,
    `Dip Stick Measurement After (cm)/ Jauge: ${dash(d.dip_stick_after_cm)}cm`,
    `Truck Flow Meter Before (L)/Fond cubi: ${dash(d.truck_flow_meter_before_l)}L  Truck Flow Meter After (L): ${dash(d.truck_flow_meter_after_l)}`,
    `Truck Plate Number: ${dash(d.truck_plate_number)}`,
    `Guard Available: ${guardAvailable}`,
    `Guard name: ${dash(d.guard_name)}`,
    `Guard number: ${dash(d.guard_number)}`,
    `Pictures: Gen running hour: ${dash(d.gen_running_hour)} / Tank Refueling action / Site plate${photoNote}`,
    ``,
    `Planifier`,
    `Start time (date of refueling): ${d.refuel_start_date} ${dash(d.refuel_start_time)}`,
    `End time: ${d.refuel_end_date} ${dash(d.refuel_end_time)}`,
    `Date planned: ${d.date_planned}`,
  ];

  return lines.join("\n");
}
