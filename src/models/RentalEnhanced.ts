export interface Rental {
  id: string;
  rental_code: string;
  user_id: string;
  device_id: string;
  station_from_id?: string;
  station_to_id?: string;
  rental_status: 'active' | 'completed' | 'overdue' | 'lost' | 'cancelled';
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
  payment_method: 'mpesa' | 'tigopesa' | 'airtelmoney' | 'halopesa' | 'card';
  qr_code?: string;
}

export interface CompleteRentalDTO {
  rental_id: string;
  station_to_id: string;
  total_hours: number;
  notes?: string;
}

export interface RentalSummary {
  rental_id: string;
  rental_code: string;
  user_name: string;
  device_code: string;
  station_from: string;
  station_to?: string;
  status: string;
  start_time: Date;
  end_time?: Date;
  total_hours?: number;
  total_amount: number;
  payment_status: string;
}

export interface PricingConfig {
  first_hour: number;
  additional_hour: number;
  daily_cap: number;
  tax_rate: number;
  deposit_amount: number;
}

// Default pricing for Tanzania
export const DEFAULT_PRICING: PricingConfig = {
  first_hour: 600,    // TZS 600
  additional_hour: 400, // TZS 400 per additional hour
  daily_cap: 3000,    // Max TZS 3,000 per day
  tax_rate: 0.18,     // 18% VAT
  deposit_amount: 5000 // TZS 5,000 deposit
};