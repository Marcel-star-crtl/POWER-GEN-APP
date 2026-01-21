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
    Current_Generators?: any[];
    // Computed fields for UI
    status?: 'scheduled' | 'overdue' | 'completed' | 'in_progress' | 'pending';
    visit_date?: string | Date; // Mapped from Actual_Date_Visit or computed
  }
  