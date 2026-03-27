export type AdminRole = 'admin' | 'manager' | 'receptionist';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AdminUser;
}
