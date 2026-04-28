// Technician Site Audit Form Types (from Template.csv)
export interface Generator {
  brand: string;
  engine_brand: string;
  alternator_brand: string;
  capacity_kva: string;
}

export interface PowerCabinet {
  rectifier_type: string;
  module_size_kw: string;
  rectifier_number: string;
  brand: string;
  capacity_kw: string;
}

export interface BatterySet {
  brand: string;
  capacity_v_ah: string;
  type: string;
  number: string;
  statut: boolean | null;
}

export interface Aircon {
  brand: string;
  capacity_v_w: string;
  statut: boolean | null;
}

export interface TechnicianSiteAuditForm {
  site_id_ihs: string;
  id_operator: string;
  name_site: string;
  topology: string;
  indoor_outdoor: string;
  sbc: string;
  number_of_gen: string;
  generators: Generator[];
  power_cabinets: PowerCabinet[];
  batteries: BatterySet[];
  aircons: Aircon[];
  additional_power_cabinet_count?: string;
  // Solar
  solar_panels_number?: string;
  solar_panels_brand?: string;
  solar_panels_capacity?: string;
  solar_panels_working?: boolean | null;
  // Environment
  environnement_leakage?: boolean | null;
  environnement_abandoned_equipment?: boolean | null;
  environnement_site_cleaning?: boolean | null;
  environnement_light_statut?: boolean | null;
  // Shelter
  shelter_statut?: boolean | null;
  // Comments & status
  comments?: string;
  timeline_to_close_issues?: string;
  overall_site_status?: string;
  sbc_feedback?: string;
  final_site_status?: string;
  date?: string;
  // Add photo, notes, and section scores if needed
  photos?: any[];
  notes?: string;
  section_scores?: Record<string, string>;
}
