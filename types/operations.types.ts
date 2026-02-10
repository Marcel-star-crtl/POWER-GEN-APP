import { Photo } from './common.types';

export type AuditStatus = 'draft' | 'submitted';

export interface SiteAuditChecklist {
  _id?: string;
  site: string;
  site_name?: string;
  site_code?: string;
  region?: string;
  sub_region?: string;
  access_ref?: string;
  time_in?: string;
  time_out?: string;
  status?: AuditStatus;

  janitorial: {
    inside_clean: boolean | null;
    outside_perimeter_clean: boolean | null;
    shelter_cleaned: boolean | null;
    outdoor_equipment_cleaned: boolean | null;
    air_blower_used: boolean | null;
  };

  fumigation: {
    rat_mice_signs_checked: boolean | null;
    chemicals_applied: boolean | null;
  };

  generator: {
    capacity?: string;
    generator_brand?: string;
    engine_brand?: string;
    alternator_brand?: string;
    controller_brand?: string;
    running_hours?: string;
    clean_inside_outside: boolean | null;
    fuel_filter_changed: boolean | null;
    oil_filter_changed: boolean | null;
    air_filter_changed: boolean | null;
    oil_leakage_checked: boolean | null;
    oil_level_max: boolean | null;
    oil_quality_checked: boolean | null;
    radiator_status_checked: boolean | null;
    fan_belt_checked: boolean | null;
    thermostat_checked: boolean | null;
    radiator_hoses_checked: boolean | null;
    coolant_level_checked: boolean | null;
    water_pump_checked: boolean | null;
    fuel_leakage_checked: boolean | null;
    fuel_piping_status_checked: boolean | null;
    water_separator_filter_checked: boolean | null;
    battery_and_charger_checked: boolean | null;
    dc_charge_alternator_belt_checked: boolean | null;
    kick_starter_checked: boolean | null;
    controller_status_checked: boolean | null;
    alarms_status_checked: boolean | null;
    temp_oil_sensors_checked: boolean | null;
    exhaust_system_checked: boolean | null;
    silencer_checked: boolean | null;
  };

  ats_system: {
    loose_connections_checked: boolean | null;
    components_checked: boolean | null;
    test_functioning_done: boolean | null;
  };

  grid: {
    grid_index?: string;
    grid_connected_operational: boolean | null;
    grid_stable: boolean | null;
  };

  avr: {
    physical_status_ok: boolean | null;
    input_output_measured: boolean | null;
  };

  fuel_tank: {
    capacity_height_cm?: string;
    capacity_width_cm?: string;
    capacity_depth_cm?: string;
    quantity_found?: string;
    quantity_refueled?: string;
    cap_closed_attached: boolean | null;
    water_separator_filter_changed: boolean | null;
    fuel_pipes_leak_checked: boolean | null;
    connected_to_earthing: boolean | null;
    fuel_certificate_issued: boolean | null;
  };

  air_conditioning: {
    ac_type?: string;
    internal_filter_cleaned: boolean | null;
    outdoor_compressor_cleaned: boolean | null;
    high_low_pressure_measured: boolean | null;
    temperature_recorded?: string;
    amps_measured: boolean | null;
    condenser_evaporator_cleaned: boolean | null;
    outdoor_fan_checked: boolean | null;
  };

  canopy: {
    rust_checked: boolean | null;
    lighting_sockets_working: boolean | null;
    roofing_sheets_good: boolean | null;
    connected_to_earthing: boolean | null;
    structure_stable: boolean | null;
    foundation_no_cracks: boolean | null;
    foundation_cracks_rectified: boolean | null;
  };

  cable_tray: {
    rust_checked: boolean | null;
    fixed_firmly: boolean | null;
    cable_section_checked: boolean | null;
    connected_to_earthing: boolean | null;
    cables_tightened: boolean | null;
    cables_have_lugs: boolean | null;
  };

  fence: {
    fence_type?: string;
    rust_checked: boolean | null;
    no_anomaly_access: boolean | null;
    gate_locking_operational: boolean | null;
    razor_wire_available: boolean | null;
    connected_to_earthing: boolean | null;
  };

  power_rectifiers: {
    modules_found?: string;
    modules_missing?: string;
    rectifier_type_capacity?: string;
    breakers_checked: boolean | null;
    output_voltage?: string;
    cabling_status_good: boolean | null;
  };

  power_batteries: {
    batteries_count?: string;
    unit_battery_capacity?: string;
    output_checked: boolean | null;
    autonomy_test_done: boolean | null;
    autonomy_estimated?: string;
  };

  cooling_system_cabinet: {
    temperature_checked: boolean | null;
    water_accumulation_signs: boolean | null;
  };

  solar_batteries: {
    batteries_count?: string;
    unit_capacity?: string;
    output_checked: boolean | null;
    autonomy_test_done: boolean | null;
    autonomy_estimated?: string;
  };

  solar_panels: {
    output_checked_before_clean: boolean | null;
    panels_cleaned: boolean | null;
    connections_checked: boolean | null;
  };

  earthing_system: {
    earth_resistance_measured: boolean | null;
    earth_resistance_value?: string;
    less_than_5_ohms: boolean | null;
    action_if_above_5?: string;
  };

  alarms_system: {
    temp_sensor_ok: boolean | null;
    power_sensor_ok: boolean | null;
    gate_lock_sensor_ok: boolean | null;
    fuel_sensor_ok: boolean | null;
    fuel_tank_sensors_ok: boolean | null;
    external_alarms_wired: boolean | null;
    alarms_reporting: boolean | null;
    alarms_not_reporting_reason?: string;
  };

  signatures: {
    subcontractor_signature?: string;
    audit_technician_signature?: string;
    regional_manager_signature?: string;
  };

  photos?: Photo[];
  section_notes?: Record<string, string>;
  section_scores?: Record<string, number>;
  total_score?: number;
  notes?: string;
}
