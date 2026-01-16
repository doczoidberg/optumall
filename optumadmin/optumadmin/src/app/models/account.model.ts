export interface Account {
  id: number;
  type: number;
  type_name: string;
  name: string;
  domain: string;
  origin?: string;
  _last_seen?: string;
  created_date: string;
  total_members: number;
  members?: AccountMember[];
  groups?: AccountGroup[];
  credits?: AccountCredits;
}

export interface AccountMember {
  id: number;
  member_id: number;
  role: number;
  role_name: string;
  user?: User;
}

export interface AccountGroup {
  id: number;
  name: string;
  description?: string;
  account_id: number;
  created_date: string;
  member_count?: number;
}

export interface AccountCredits {
  id: number;
  account_id: number;
  credits: number;
  credits_used: number;
  last_credit_purchase?: string;
  last_token_purchase?: string;
}

export interface AccountType {
  value: number;
  label: string;
}

export const ACCOUNT_TYPES: AccountType[] = [
  { value: 0, label: 'Individual' },
  { value: 1, label: 'Organization' },
  { value: 3, label: 'University' }
];

export function getAccountTypeName(type: number): string {
  const found = ACCOUNT_TYPES.find(t => t.value === type);
  return found ? found.label : 'Unknown';
}
