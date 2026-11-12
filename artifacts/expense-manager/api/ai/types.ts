export type Provider = 'gemini' | 'claude';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ExpenseRow = {
  amount: number;
  description: string;
  category: string;
  date: string;
  notes: string | null;
};

export type SalaryRow = {
  month: string;
  amount: number;
};

export type LendingRow = {
  person_name: string;
  amount: number;
  type: string;
  due_date: string | null;
  status: string;
};

export type CashRow = {
  description: string;
  amount: number;
  type: string;
  date: string;
  wallet_location: string | null;
};

export type LoanRow = {
  lender_name: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  outstanding_balance: number;
  status: string;
};

export type EmiRow = {
  loan_or_item: string;
  monthly_amount: number;
  due_day: number;
  total_installments: number;
  remaining_installments: number;
  status: string;
};

export type CacheEntry = {
  tokens: Set<string>;
  reply: string;
  provider: Provider;
  at: number;
};

