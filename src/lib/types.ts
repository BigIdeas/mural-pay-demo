// Order Types
export type OrderStatus = 'pending' | 'paid' | 'payout_pending' | 'payout_completed' | 'failed';

export interface OrderItem {
  id: string;
  name: string;
  price: number; // USD
  quantity: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number; // USD
  uniqueAmount: number; // USD with micro-cents for matching
  status: OrderStatus;
  createdAt: string;
  paidAt?: string;
  transactionHash?: string;
  payoutId?: string;
  payoutStatus?: string;
  copAmount?: number;
  exchangeRate?: number;
}

// Mural API Types
export interface MuralAccount {
  id: string;
  name: string;
  status: string;
  balance?: {
    balance: string;
    tokenSymbol: string;
  }[];
}

export interface MuralTransaction {
  id: string;
  status: string;
  type: string;
  amount: string;
  tokenSymbol: string;
  createdAt: string;
  updatedAt: string;
  transactionHash?: string;
}

export interface MuralPayout {
  id: string;
  status: string;
  recipientAmount: string;
  recipientCurrency: string;
  senderAmount: string;
  senderCurrency: string;
  exchangeRate?: string;
  createdAt: string;
}

export interface MuralCounterparty {
  id: string;
  name: string;
  email?: string;
  payoutMethods?: MuralPayoutMethod[];
}

export interface MuralPayoutMethod {
  id: string;
  type: string;
  currency: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountType: string;
  };
}

export interface MuralWebhookEvent {
  id: string;
  eventType: string;
  payload: {
    accountId?: string;
    amount?: string;
    tokenSymbol?: string;
    transactionHash?: string;
    [key: string]: unknown;
  };
  createdAt: string;
}

// Product Catalog
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // USD
  image: string;
}

// Cart
export interface CartItem extends Product {
  quantity: number;
}
