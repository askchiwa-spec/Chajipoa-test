export interface Rental {
  id: string;
  rental_code: string;
  user_id: string;
  device_id: string;
  station_from_id?: string;
  station_to_id?: string;
  rental_status: 'active' | 'completed' | 'overdue' | 'lost';
  start_time: Date;
  end_time?: Date;
  expected_end_time?: Date;
  total_hours?: number;
  base_amount: number;
  tax_amount: number;
  deposit_amount: number;
  late_fee: number;
  total_amount: number;
  deposit_returned: boolean;
  deposit_return_amount: number;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method?: string;
  payment_reference?: string;
  qr_code_used?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRentalDTO {
  user_id: string;
  device_id: string;
  station_from_id: string;
  deposit_amount: number;
  payment_method: string;
}

export interface CompleteRentalDTO {
  rental_id: string;
  station_to_id: string;
  total_hours: number;
  total_amount: number;
}