export type AdminRole = 'admin' | 'manager' | 'receptionist';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  template_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AdminUser;
  permissions: string[];
  must_change_password: boolean;
}

export interface CurrentUserResponse {
  user: AdminUser;
  permissions: string[];
  must_change_password: boolean;
}
