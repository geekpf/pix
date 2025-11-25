export interface CustomerData {
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

export interface Transaction {
  id?: string;
  customer_name: string;
  customer_email: string;
  customer_cpf: string;
  abacate_billing_id: string;
  pix_code: string;
  pix_url: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
  created_at?: string;
}

export interface AbacateBillingResponse {
  id: string;
  url: string;
  amount: number;
  status: string;
  pix: {
    code: string;
    qrcode: string; // Base64 or URL
  };
}

export interface AppConfig {
  abacateApiKey: string;
  supabaseUrl: string;
  supabaseKey: string;
}
