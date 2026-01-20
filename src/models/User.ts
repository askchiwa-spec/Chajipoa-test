export interface User {
  id: string;
  phone_number: string;
  national_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  user_type: 'regular' | 'tourist' | 'corporate';
  account_status: 'active' | 'suspended' | 'blacklisted';
  deposit_balance: number;
  total_rentals: number;
  total_spent: number;
  blacklist_reason?: string;
  blacklisted_at?: Date;
  password_hash?: string;
  otp_code?: string;
  otp_expires_at?: Date;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

export interface CreateUserDTO {
  phone_number: string;
  national_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  user_type?: 'regular' | 'tourist' | 'corporate';
  password?: string;
}

export interface UpdateUserDTO {
  email?: string;
  first_name?: string;
  last_name?: string;
  user_type?: 'regular' | 'tourist' | 'corporate';
}