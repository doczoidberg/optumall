export interface User {
  id: number;
  email: string;
  user_name: string;
  first_name: string;
  last_name: string;
  role: number;
  role_name: string;
  account_id: number;
  avatar?: string;
  avatar_url?: string;
  email_validated?: boolean;
  two_factor_enabled?: boolean;
  organization?: string;
  group?: string;
  created_date?: string;
  organizations?: UserOrganization[];
}

export interface UserOrganization {
  account_id: number;
  account_name: string;
  member_role: number;
  role_name: string;
}

export interface AuthUser {
  id: number;
  email: string;
  user_name: string;
  first_name: string;
  last_name: string;
  role: number;
  account_id: number;
  token: string;
}

export interface LoginRequest {
  user_name: string;
  password: string;
  code?: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: AuthUser;
}

export const USER_ROLES = {
  USER: 0,
  ADMIN: 1,
  SUPERADMIN: 2
} as const;

export function getRoleName(role: number): string {
  switch (role) {
    case USER_ROLES.SUPERADMIN:
      return 'Super Admin';
    case USER_ROLES.ADMIN:
      return 'Admin';
    default:
      return 'User';
  }
}
