export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'supervisor' | 'technician' | 'diesel_manager' | 'data_collector' | 'analyst' | 'operations';
  phone?: string;
  isActive: boolean;
  assignedTechnicians?: string[];
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  current: number;
  pageSize: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginationMeta;
}

export interface ApiError {
  message: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface Photo {
  url: string;
  category: 'before' | 'during' | 'after' | 'issue' | 'parts' | 'general';
  description: string;
  uploaded_at: Date;
}

// StatusType represents the unified task/visit lifecycle:
// - 'pending': Task assigned but not started
// - 'scheduled': Task scheduled for a specific date
// - 'in_progress': Technician actively working on site
// - 'draft': Visit form saved but not submitted
// - 'pending_approval': Visit submitted, awaiting supervisor review
// - 'approved': Visit approved by supervisor
// - 'rejected': Visit rejected, needs revision
// - 'completed': Fully completed and approved
export type StatusType = 'pending' | 'scheduled' | 'in_progress' | 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'completed';
export type PriorityType = 'low' | 'medium' | 'high' | 'critical';
export type VisitType = 'PM' | 'END' | 'RF' | 'PM+END' | 'PM+RF' | 'RF+END' | 'PM+RF+END';
