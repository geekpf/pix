import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Transaction } from '../types';
import { SUPABASE_URL, SUPABASE_KEY } from '../config';

// Initialize immediately with default config
let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Allow overriding config via settings
export const initSupabase = (url: string, key: string) => {
  if (!url || !key) return;
  supabase = createClient(url, key);
};

// --- Config Management (Abacate Key stored in DB) ---

export const getAbacateApiKey = async (): Promise<string | null> => {
  // If Supabase isn't configured, try local fallback immediately
  if (!supabase) {
    return localStorage.getItem('abacate_api_key_fallback');
  }

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'abacate_api_key')
      .single();

    if (error) {
      // PGRST205/42P01: Table missing
      // PGRST116: Row missing (Table exists, but key not set)
      if (['PGRST205', '42P01', 'PGRST116'].includes(error.code)) {
        console.warn(`Supabase config not found (${error.code}). Using local storage fallback.`);
        return localStorage.getItem('abacate_api_key_fallback');
      }
      
      console.error('Error fetching Abacate Key from DB:', JSON.stringify(error));
      return null;
    }

    return data?.value || null;
  } catch (err) {
    console.warn("Unexpected error fetching key, trying fallback:", err);
    return localStorage.getItem('abacate_api_key_fallback');
  }
};

export const saveAbacateApiKeyToDB = async (apiKey: string): Promise<void> => {
  if (!supabase) {
    // If no supabase, just save locally
    localStorage.setItem('abacate_api_key_fallback', apiKey);
    return;
  }

  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'abacate_api_key', value: apiKey }, { onConflict: 'key' });

    if (error) {
      // Check for missing table error
      if (['PGRST205', '42P01'].includes(error.code)) {
        console.warn("Supabase table 'app_config' not found. Saving to local storage fallback.");
        localStorage.setItem('abacate_api_key_fallback', apiKey);
        return;
      }

      console.error('Error saving Abacate Key to DB:', JSON.stringify(error));
      throw new Error("Could not save API Key to database");
    } else {
      // If DB save succeeds, remove fallback to prevent confusion
      localStorage.removeItem('abacate_api_key_fallback');
    }
  } catch (err) {
    console.warn("Exception during DB save, using fallback:", err);
    localStorage.setItem('abacate_api_key_fallback', apiKey);
  }
};

// --- Transaction Management ---

export const saveTransaction = async (transaction: Transaction): Promise<void> => {
  if (!supabase) return;

  const { error } = await supabase
    .from('transactions')
    .insert([
      {
        customer_name: transaction.customer_name,
        customer_email: transaction.customer_email,
        customer_cpf: transaction.customer_cpf,
        abacate_billing_id: transaction.abacate_billing_id,
        pix_code: transaction.pix_code,
        pix_url: transaction.pix_url,
        amount: transaction.amount,
        status: transaction.status,
      },
    ]);

  if (error) {
    // Handle missing table gracefully without cluttering console with errors
    if (['PGRST205', '42P01'].includes(error.code)) {
       console.warn("Transaction not saved: 'transactions' table missing in Supabase. (Functionality continues without history)");
    } else {
       console.error('Error saving transaction to Supabase:', JSON.stringify(error));
    }
  }
};

export const updateTransactionStatus = async (billingId: string, status: string): Promise<void> => {
  if (!supabase) return;

  const { error } = await supabase
    .from('transactions')
    .update({ status: status })
    .eq('abacate_billing_id', billingId);

  if (error) {
    if (['PGRST205', '42P01'].includes(error.code)) {
        // Silently ignore missing table updates
    } else {
        console.error('Error updating transaction in Supabase:', JSON.stringify(error));
    }
  } else {
    console.log(`Transaction ${billingId} updated to ${status}`);
  }
};
