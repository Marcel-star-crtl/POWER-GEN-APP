import { Photo, StatusType, PriorityType, VisitType } from './common.types';

// IMPORTANT: In this system, "Maintenance" records represent BOTH:
// 1. TASKS - Assigned work for technicians to perform
// 2. VISITS - Completed site visit records with all details
// These are unified into a single entity that progresses from assignment to completion
// Use "Task" terminology in UI when referring to work assignments
// Use "Visit" terminology when referring to completed/submitted work

// Note: File type is different in React Native
export interface FileWithPreview {
  uri: string;
  name?: string;
  type?: string;
  preview?: string;
  category?: string;
  description?: string;
}

export interface GeneratorDetail {
  generator_number: number;
  brand: string;
  engine_brand?: string;
  serial_number: string;
  maintenance_cycle?: string;
  kva?: number;
  dg_age_check?: string;
  dg_age?: string;
  hour_meter_check?: string;
  ch_actuel: number;
  ch_ancien?: number;
  run_hours?: number;
  cph?: number;
  load_1ph?: number;
  load_2ph?: number;
  load_3ph?: number;
  dc_load?: number;
  comments_cph?: string;
}

export interface FuelData {
  fuel_card_number?: string;
  tom_card_debit?: number;
  price_per_liter?: number;
  tank_type?: 'EXT' | 'INT';
  tank_capacity?: number;
  tank_dimensions?: {
    long?: number;
    large?: number;
    hauteur?: number;
    coeficiant?: number;
  };
  fond_de_cuve?: number;
  fuel_sq_check?: string;
  qte_precedente?: number;
  hauteur_gasoil_trouvee_cm?: number;
  qte_trouvee?: number;
  qte_t_cms?: number;
  qte_ajoutee?: number;
  qte_laissee?: number;
  qte_l_cms?: number;
  qte_consommee?: number;
}

export interface ElectricalData {
  earthing_ohm?: number;
  eneo_working?: string;
  phase_type?: string;
  n_ph1_voltage?: number;
  n_ph2_voltage?: number;
  n_ph3_voltage?: number;
  eneo_meter_number?: string;
  eneo_sq_check?: string;
  actual_index?: number;
  previous_index?: number;
  consumed_kwa?: number;
  comments_on_grid?: string;
}

export interface IssuesFound {
  DG_Issues?: string;
  IPT_BB_Issues?: string;
  Issue_of_Aircon?: string;
  Issue_of_Solar?: string;
  Any_Other_Issue?: string;
  Parts_Replaced?: string;
  Issues_Corrective_Date?: Date;
}

export interface PartUsed {
  part_id?: string;
  part_name: string;
  part_number?: string;
  quantity_used: number;
  technician_notes?: string;
}

export interface PowerCabinet {
  cabinet_number: number;
  type?: string;
  rectifier_type?: string;
  num_rectifiers?: number;
  capacity_per_rectifier?: number;
  num_batteries?: number;
  battery_capacity?: string;
  battery_autonomy?: number;
}

// Maintenance = Task/Visit (unified concept)
// A maintenance record starts as a task assignment and becomes a visit when completed
export interface Maintenance {
  _id: string;
  maintenance_id: string;
  site_id: string;
  site_name?: string;
  visit_reference: string; // Generated when visit is submitted
  
  equipment_checks?: any; // Detailed checklists
  
  // Assignment Details (Task phase)
  scheduled_date?: Date; // When task is scheduled
  assigned_date?: Date;
  due_date?: Date;
  
  technician: {
    _id: string;
    fullName: string;
    email: string;
  };
  technician_name?: string;
  supervisor: {
    _id: string;
    fullName: string;
  };
  visit_type: VisitType;
  visit_date: Date;
  prev_visit_date?: Date;
  hours_on_site?: number;
  sbc?: string;
  site_metadata?: {
    cluster?: string;
    site_priority?: string;
    state?: string;
    operator?: string;
    power_topology?: string;
    outdoor_indoor?: string;
  };
  process_tracking?: {
    ongoing_process_num?: string;
    pm_end_process_num?: string;
    rf_process_num?: string;
  };
  work_performed?: string;
  issues_found?: IssuesFound;
  parts_used?: PartUsed[];
  generators_checked?: GeneratorDetail[];
  combined_stats?: {
    total_run_hour?: number;
    ccph?: number;
    cl?: number;
    pertes?: number;
    dg_vs_hours?: string;
    grid_gen_percent?: number;
    reason_grid_gen_percent?: string;
    automatization_status?: string;
    ch_next_vidange?: number;
  };
  fuel_data?: FuelData;
  pm_checks?: {
    belt?: string;
    oil_filter?: string;
    fuel_filter?: string;
    separ_filter?: string;
    air_filter?: string;
    qty_oil_changed?: number;
    qty_radiator_water?: number;
    dirty_oil?: string;
  };
  power_systems?: {
    power_cabinets?: PowerCabinet[];
    battery_threshold_dg_start?: number;
  };
  electrical_data?: ElectricalData;
  photos?: Photo[];
  status: StatusType;
  is_draft: boolean;
  draft_saved_at?: Date;
  submitted_at?: Date;
  reviewed_at?: Date;
  reviewed_by?: {
    _id: string;
    fullName: string;
  };
  review_comments?: string;
  rejection_reason?: string;
  completed_at?: Date;
  completion_notes?: string;
  priority: PriorityType;
  estimated_duration?: number;
  actual_duration?: number;
  createdAt: Date;
  updatedAt: Date;
  days_pending?: number;
  site_details?: {
    Site_Name: string;
    Region: string;
    GRATO_Cluster: string;
  };
}
