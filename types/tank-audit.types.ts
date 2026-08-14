// Tank Audit Form Types — matches the SITE TANK AUDIT PLAN document's
// structure and models/TankAudit.js on the backend exactly.

export type CheckStatus = "ok" | "issue" | "na";
export type Severity = "critical" | "major" | "minor";

export interface CheckItem {
  status: CheckStatus | null;
  notes: string;
  severity: Severity | null; // only meaningful when status === "issue"
}

export const emptyCheckItem = (): CheckItem => ({
  status: null,
  notes: "",
  severity: null,
});

// A single equipment log attachment — reuses the same photo-capture
// mechanism as the plan's check-area evidence photos (camera or
// gallery), since most on-site equipment (power cabinet, generator)
// has no direct file-export a phone could pull from; the practical way
// to "submit a log" is a photo of the display or printout. `equipment`
// tags which piece of equipment it came from.
export type LogFileEquipment = "power_cabinet" | "generator" | "other";
export interface LogFileAttachment {
  uri: string;
  name?: string;
  type?: string;
  equipment: LogFileEquipment;
}

export interface TankAuditForm {
  // Site information
  site_id_ihs: string;
  site_name: string;
  region: string;
  cluster: string;
  site_priority: string;
  tank_capacity_l: string;
  tank_length_m: string;
  tank_width_m: string;
  tank_height_m: string;
  tank_base_type: string;
  functional_topology: string;
  audit_date: string;
  auditor_name: string;

  // Fuel level cross-check
  dip_reading_l: string;
  cms_reading_l: string;
  theoretical_stock_l: string;

  // The seven on-site physical checks from the plan
  check_tank_capacity_verification: CheckItem;
  check_fuel_level: CheckItem;
  check_structural_condition: CheckItem;
  check_leakage: CheckItem;
  check_caps_locking_security: CheckItem;
  check_pipe_passage_earthing: CheckItem;
  check_sensor_hardware: CheckItem;
  // Direct addition per the user's request — generators with faulty
  // gen cards, flagged for replacement with a mechanical counter meter.
  check_gen_cards_faulty: CheckItem;

  // Direct addition per the user's request
  logs_collected: boolean | null;
  // Direct addition — a simple yes/no question, distinct from
  // check_gen_cards_faulty above (the full status/severity/notes/photos
  // check item matching the plan's other seven checks).
  gen_card_faulty: boolean | null;

  general_notes: string;
}

export const buildInitialTankAuditForm = (siteId: string): TankAuditForm => ({
  site_id_ihs: siteId,
  site_name: "",
  region: "",
  cluster: "",
  site_priority: "",
  tank_capacity_l: "",
  tank_length_m: "",
  tank_width_m: "",
  tank_height_m: "",
  tank_base_type: "",
  functional_topology: "",
  audit_date: "",
  auditor_name: "",
  dip_reading_l: "",
  cms_reading_l: "",
  theoretical_stock_l: "",
  check_tank_capacity_verification: emptyCheckItem(),
  check_fuel_level: emptyCheckItem(),
  check_structural_condition: emptyCheckItem(),
  check_leakage: emptyCheckItem(),
  check_caps_locking_security: emptyCheckItem(),
  check_pipe_passage_earthing: emptyCheckItem(),
  check_sensor_hardware: emptyCheckItem(),
  check_gen_cards_faulty: emptyCheckItem(),
  logs_collected: null,
  gen_card_faulty: null,
  general_notes: "",
});

// The eight check areas, in the plan's own order (plus the gen-cards
// addition at the end) — used to drive the form's checklist rendering
// and the section-photo keys.
export const TANK_AUDIT_CHECK_AREAS: { key: keyof TankAuditForm; labelKey: string; descKey: string }[] = [
  { key: "check_tank_capacity_verification", labelKey: "tank_capacity_verification", descKey: "tank_capacity_verification_desc" },
  { key: "check_fuel_level", labelKey: "fuel_level_check", descKey: "fuel_level_check_desc" },
  { key: "check_structural_condition", labelKey: "structural_condition", descKey: "structural_condition_desc" },
  { key: "check_leakage", labelKey: "leakage_checks", descKey: "leakage_checks_desc" },
  { key: "check_caps_locking_security", labelKey: "caps_locking_security", descKey: "caps_locking_security_desc" },
  { key: "check_pipe_passage_earthing", labelKey: "pipe_passage_earthing", descKey: "pipe_passage_earthing_desc" },
  { key: "check_sensor_hardware", labelKey: "sensor_hardware", descKey: "sensor_hardware_desc" },
  { key: "check_gen_cards_faulty", labelKey: "gen_cards_faulty", descKey: "gen_cards_faulty_desc" },
];
