export interface Device {
  id: string;
  device_code: string;
  qr_code_url?: string;
  station_id?: string;
  current_status: 'available' | 'rented' | 'maintenance' | 'lost' | 'decommissioned';
  battery_level: number;
  health_score: number;
  last_maintenance_date?: Date;
  purchase_date: Date;
  warranty_until?: Date;
  rental_count: number;
  total_earnings: number;
  last_known_latitude?: number;
  last_known_longitude?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DeviceStatusUpdate {
  device_id: string;
  battery_level: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  health_score?: number;
}

export interface Station {
  id: string;
  station_code: string;
  name: string;
  location_type: 'bus_terminal' | 'shopping_mall' | 'airport' | 'university' | 'hospital' | 'tourist_area';
  address: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  total_slots: number;
  available_slots: number;
  is_operational: boolean;
  has_power_backup: boolean;
  has_solar: boolean;
  installation_date: Date;
  last_checked: Date;
  created_at: Date;
  updated_at: Date;
}