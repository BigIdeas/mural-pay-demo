import { MuralAccount, MuralTransaction, MuralPayout, MuralCounterparty, MuralPayoutMethod } from './types';

const MURAL_API_BASE = 'https://api-staging.muralpay.com/api';

interface MuralApiOptions {
  useTransferKey?: boolean;
}

async function muralFetch<T>(
  endpoint: string,
  options: RequestInit & MuralApiOptions = {}
): Promise<T> {
  const { useTransferKey, ...fetchOptions } = options;
  const apiKey = useTransferKey
    ? process.env.MURAL_TRANSFER_API_KEY
    : process.env.MURAL_API_KEY;

  if (!apiKey) {
    throw new Error(`Mural API key not configured: ${useTransferKey ? 'MURAL_TRANSFER_API_KEY' : 'MURAL_API_KEY'}`);
  }

  const response = await fetch(`${MURAL_API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Mural API error: ${response.status} ${response.statusText}`, errorText);
    throw new Error(`Mural API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Account Management
export async function getAccounts(): Promise<{ results: MuralAccount[] }> {
  return muralFetch<{ results: MuralAccount[] }>('/accounts');
}

export async function getAccount(accountId: string): Promise<MuralAccount> {
  return muralFetch<MuralAccount>(`/accounts/${accountId}`);
}

export async function getAccountBalance(accountId: string): Promise<MuralAccount> {
  return muralFetch<MuralAccount>(`/accounts/${accountId}`);
}

// Transaction History (for payment detection via polling)
// Endpoint: GET /accounts/{accountId}/transactions
export async function getAccountTransactions(
  accountId: string,
  params?: { status?: string; limit?: number }
): Promise<{ results: MuralTransaction[] }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append('status', params.status);
  if (params?.limit) searchParams.append('limit', params.limit.toString());

  const query = searchParams.toString();
  return muralFetch<{ results: MuralTransaction[] }>(
    `/accounts/${accountId}/transactions${query ? `?${query}` : ''}`
  );
}

export async function getTransaction(transactionId: string): Promise<MuralTransaction> {
  return muralFetch<MuralTransaction>(`/transactions/${transactionId}`);
}


// Counterparty Management (for payout recipients)
export async function getCounterparties(): Promise<{ results: MuralCounterparty[] }> {
  return muralFetch<{ results: MuralCounterparty[] }>('/counterparties');
}

export async function getCounterparty(counterpartyId: string): Promise<MuralCounterparty> {
  return muralFetch<MuralCounterparty>(`/counterparties/${counterpartyId}`);
}

export async function createCounterparty(data: {
  name: string;
  email?: string;
  type: 'individual' | 'business';
}): Promise<MuralCounterparty> {
  return muralFetch<MuralCounterparty>('/counterparties', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Payout Method Management
export async function createPayoutMethod(
  counterpartyId: string,
  data: {
    type: 'bank_transfer';
    currency: string;
    bankDetails: {
      bankName: string;
      accountNumber: string;
      accountType: 'checking' | 'savings';
      routingNumber?: string;
      // Colombia specific
      documentType?: string;
      documentNumber?: string;
    };
  }
): Promise<MuralPayoutMethod> {
  return muralFetch<MuralPayoutMethod>(`/counterparties/${counterpartyId}/payout-methods`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get FX Rate for COP
export async function getFxRate(
  fromCurrency: string = 'USDC',
  toCurrency: string = 'COP'
): Promise<{ rate: number; validUntil: string }> {
  const response = await muralFetch<{ rate: string; validUntil: string }>(
    `/fx-rates?from=${fromCurrency}&to=${toCurrency}`
  );
  return {
    rate: parseFloat(response.rate),
    validUntil: response.validUntil,
  };
}

// Payout Execution (requires transfer-api-key)
// Endpoint: POST /payout-requests
export async function createPayoutRequest(data: {
  payouts: Array<{
    counterpartyId: string;
    payoutMethodId: string;
    amount: string;
    currency: string;
    memo?: string;
  }>;
}): Promise<MuralPayout> {
  return muralFetch<MuralPayout>('/payout-requests', {
    method: 'POST',
    body: JSON.stringify(data),
    useTransferKey: true,
  });
}

export async function executePayoutRequest(payoutId: string): Promise<MuralPayout> {
  return muralFetch<MuralPayout>(`/payout-requests/${payoutId}/execute`, {
    method: 'POST',
    useTransferKey: true,
  });
}

export async function getPayoutRequest(payoutId: string): Promise<MuralPayout> {
  return muralFetch<MuralPayout>(`/payout-requests/${payoutId}`);
}

// Webhook Management
export async function registerWebhook(data: {
  url: string;
  events: string[];
}): Promise<{ id: string; url: string; events: string[] }> {
  return muralFetch<{ id: string; url: string; events: string[] }>('/webhooks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getWebhooks(): Promise<{ results: { id: string; url: string; events: string[] }[] }> {
  return muralFetch<{ results: { id: string; url: string; events: string[] }[] }>('/webhooks');
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  await muralFetch<void>(`/webhooks/${webhookId}`, {
    method: 'DELETE',
  });
}

// Deposit Address (from env, documented in payment instructions)
export function getDepositAddress(): string {
  const address = process.env.MURAL_DEPOSIT_ADDRESS;
  if (!address) {
    throw new Error('MURAL_DEPOSIT_ADDRESS not configured');
  }
  return address;
}

// Helper: Convert USDC amount to COP
export async function convertUsdcToCop(usdcAmount: number): Promise<{
  copAmount: number;
  rate: number;
}> {
  const { rate } = await getFxRate('USDC', 'COP');
  return {
    copAmount: Math.round(usdcAmount * rate * 100) / 100, // Round to 2 decimals
    rate,
  };
}

// Helper: Create payout to Colombian bank
export async function createCopPayout(
  usdcAmount: number,
  counterpartyId: string,
  payoutMethodId: string,
  memo?: string
): Promise<MuralPayout> {
  const payout = await createPayoutRequest({
    payouts: [{
      counterpartyId,
      payoutMethodId,
      amount: usdcAmount.toString(),
      currency: 'USDC',
      memo: memo || 'Merchant payout',
    }],
  });

  return executePayoutRequest(payout.id);
}
