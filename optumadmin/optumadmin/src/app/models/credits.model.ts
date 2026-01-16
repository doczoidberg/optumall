export interface CreditBalance {
  account_id: number;
  credits: number;
  credits_used: number;
  available_credits: number;
  last_credit_purchase?: string;
  last_token_purchase?: string;
}

export interface CreditTransaction {
  id: number;
  account_id: number;
  package_id: string;
  package_name: string;
  credits: number;
  amount: number;
  currency: string;
  status: string;
  stripe_session_id?: string;
  created_date: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  description?: string;
}

export interface CreditUsageLog {
  id: number;
  account_id: number;
  credits_used: number;
  resource_type: string;
  resource_id: string;
  description?: string;
  created_date: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'starter', name: 'Starter', credits: 100, price: 10, currency: 'USD', description: 'Perfect for getting started' },
  { id: 'professional', name: 'Professional', credits: 500, price: 45, currency: 'USD', description: 'For growing teams' },
  { id: 'enterprise', name: 'Enterprise', credits: 1000, price: 80, currency: 'USD', description: 'Best value for larger organizations' },
  { id: 'ultimate', name: 'Ultimate', credits: 5000, price: 350, currency: 'USD', description: 'For high-volume usage' }
];
