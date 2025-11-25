import { AbacateBillingResponse, CustomerData } from '../types';

const BASE_URL = 'https://api.abacatepay.com/v1';

// Helper to handle requests with CORS fallback
async function request(url: string, options: RequestInit) {
  try {
    // 1. Try direct request
    const response = await fetch(url, options);
    return response;
  } catch (error: any) {
    // 2. If Failed to fetch (likely CORS), try via proxy
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      console.warn("Direct fetch failed (likely CORS). Retrying with proxy...");
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      return fetch(proxyUrl, options);
    }
    throw error;
  }
}

export const createBilling = async (
  apiKey: string,
  customer: CustomerData,
  amountInCents: number
): Promise<AbacateBillingResponse> => {
  try {
    // Updated endpoint as per instructions
    const url = `${BASE_URL}/pixQrCode/create`;
    
    const payload = {
      amount: amountInCents,
      expiresIn: 3600, // 1 hour expiration
      description: "Pagamento Pix - Abacate Pay",
      customer: {
        name: customer.name,
        cellphone: customer.phone, // Sending formatted: (11) 99999-9999
        email: customer.email,
        taxId: customer.cpf // Sending formatted: 000.000.000-00
      },
      metadata: {
        externalId: "pix-" + Date.now()
      }
    };

    const response = await request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || (errorData.data && JSON.stringify(errorData.data)) || errorMessage;
      } catch (e) {
        // Response was not JSON
      }
      throw new Error(errorMessage);
    }

    const json = await response.json();
    console.log("Abacate Pay Response:", json);
    
    // The new response format puts everything inside "data"
    const data = json.data;

    if (!data || !data.brCode) {
      console.error("Structure Mismatch. keys in data:", data ? Object.keys(data) : 'null');
      throw new Error("Invalid response format from Abacate Pay. brCode not found.");
    }

    return {
      id: data.id,
      url: "", // Endpoint does not return a hosted checkout URL
      amount: data.amount,
      status: data.status,
      pix: {
        code: data.brCode, // The copy-paste code
        qrcode: data.brCodeBase64 // The Base64 image
      }
    };
  } catch (error) {
    console.error("Abacate Pay API Error:", error);
    throw error;
  }
};

export const checkBillingStatus = async (apiKey: string, billingId: string): Promise<string> => {
  try {
    // Attempting to check status via list endpoint filtered by ID
    // Assuming consistency with naming convention: /pixQrCode/list
    const response = await request(`${BASE_URL}/pixQrCode/list?id=${billingId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }
    });

    if (!response.ok) return 'PENDING';

    const json = await response.json();
    
    // Handle list response
    if (json.data && Array.isArray(json.data)) {
        const item = json.data.find((b: any) => b.id === billingId);
        return item ? item.status : 'PENDING';
    }
    
    return 'PENDING';
  } catch (error) {
    console.error("Status Check Error:", error);
    return 'PENDING';
  }
};