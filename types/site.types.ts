import { Generator } from './generator.types';

export interface Site {
    _id: string;
    Site_Name: string;
    IHS_ID_SITE?: string;
    IHS_ID?: string;
    Region?: string;
    GRATO_Cluster?: string;
    cluster?: string | { _id: string; name: string };
    Actual_Date_Visit?: string | Date; // Last visit date
    Location?: string; // Sometimes computed
    Sites_Priority?: string;
    Sites_Type?: string;
    Latitude?: number;
    Longitude?: number;
    Current_Generators?: Generator[];
    // Computed fields for UI
    status?: 'scheduled' | 'overdue' | 'completed' | 'in_progress' | 'pending';
    visit_date?: string | Date; // Mapped from Actual_Date_Visit or computed
    next_maintenance?: {
      maintenance_id: string;
      date: string | Date;
      type: string;
      priority: string;
    };
    days_since_last_visit?: number;
    needs_visit?: boolean;
  }
  