export interface VisitFormData {
  // Site Information (Required)
  site_id: string;
  visit_type: 'PM' | 'END' | 'RF' | 'PM+END' | 'PM+RF' | 'RF+END' | 'PM+RF+END';
  visit_date: Date;
  hours_on_site?: number;
  
  // Generator Data (Optional)
  generators_checked?: Array<{
    generator_number?: number;
    brand?: string;
    serial_number?: string;
    ch_actuel?: number;
    ch_ancien?: number;
    run_hours?: number;
    comments_cph?: string;
  }>;
  
  // Fuel Data (Optional)
  fuel_data?: {
    fuel_card_number?: string;
    qte_trouvee?: number;
    qte_ajoutee?: number;
    qte_laissee?: number;
    qte_consommee?: number;
  };
  
  // Electrical Data (Optional)
  electrical_data?: {
    eneo_working?: string;
    earthing_ohm?: number;
    n_ph1_voltage?: number;
    n_ph2_voltage?: number;
    n_ph3_voltage?: number;
  };
  
  // Work & Issues (Optional)
  work_performed?: string;
  issues_found?: {
    DG_Issues?: string;
    Any_Other_Issue?: string;
  };
  
  // Photos (Optional)
  photos?: Array<{
    uri: string;
    category: 'before' | 'during' | 'after' | 'issue' | 'parts' | 'general';
    description?: string;
  }>;
}
