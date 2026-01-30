export interface Generator {
  _id: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  status?: 'active' | 'inactive' | 'maintenance' | 'faulty';
  installation_date?: string | Date;
  last_maintenance?: string | Date;
  specifications?: {
    rated_power_kw?: number;
    rated_power_kva?: number;
    voltage?: number;
    frequency?: number;
    fuel_type?: string;
    fuel_capacity?: number;
    engine_model?: string;
    alternator_model?: string;
  };
  current_stats?: {
    running_hours?: number;
    fuel_level?: number;
    temperature?: number;
    voltage_output?: number;
    current_output?: number;
  };
}

export interface GeneratorCheckData {
  generator_id?: string;
  batteryStatus?: boolean | null;
  fanBeltStatus?: boolean | null;
  radiatorStatus?: boolean | null;
  coolantStatus?: boolean | null;
  i1?: string;
  i2?: string;
  i3?: string;
  v1?: string;
  v2?: string;
  v3?: string;
  comments?: string;
  photos?: {
    uri: string;
    name?: string;
    category?: string;
  }[];
}
