export interface Part {
  _id: string;
  name: string;
  part_number: string;
  description?: string;
  category: string;
  inventory: {
    stock: number;
    unit?: string;
    location?: string;
  };
  pricing?: {
    unit_cost: number;
    currency: string;
  };
  status: 'active' | 'inactive' | 'discontinued';
}

export interface PartRequestItem {
  part: string | Part;
  part_name?: string;
  part_number?: string;
  quantity: number;
}

export interface PartRequest {
  _id: string;
  request_id: string;
  technician: string;
  items: PartRequestItem[];
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  notes?: string;
  site?: string;
  createdAt: string;
  updatedAt: string;
}
