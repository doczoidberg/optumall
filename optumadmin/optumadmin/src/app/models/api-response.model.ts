export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface StatsResponse {
  success: boolean;
  data: {
    total_accounts: number;
    total_users: number;
    total_groups: number;
    total_licenses: number;
    accounts_by_type: {
      individual: number;
      organization: number;
      university: number;
    };
  };
}

export interface SearchResult {
  accounts: Array<{
    id: number;
    name: string;
    domain: string;
    type_name: string;
  }>;
  users: Array<{
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    account_name: string;
  }>;
}
