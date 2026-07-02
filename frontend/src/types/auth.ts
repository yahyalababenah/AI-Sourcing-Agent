export interface UserCreate {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  // Admin accounts cannot be self-registered (see TESTING_FINDINGS.md #0e) —
  // only client/agent are valid here.
  role?: "agent" | "client";
  // Required when role is "client".
  company_name?: string;
  // Required when role is "agent".
  factory_name?: string;
  location_in_china?: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface TokenRefresh {
  refresh_token: string;
}

export type UserRole = "client" | "agent" | "admin";

export interface SupplierProfile {
  factory_name: string;
  location_in_china: string;
  specialty?: string | null;
  business_registration_number?: string | null;
  business_license_url?: string | null;
  factory_address?: string | null;
  verification_status: string;
}

export interface ClientProfile {
  company_name: string;
  preferred_port?: string | null;
  contact_number?: string | null;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  created_at: string;
  profile?: SupplierProfile | ClientProfile | null;
}
