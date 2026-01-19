import { Redis } from '@upstash/redis';
import { Order, OrderStatus } from './types';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ORDER_PREFIX = 'order:';
const ORDER_INDEX = 'orders:index';
const AMOUNT_INDEX = 'orders:by-amount:';

// Generate a unique order ID
export function generateOrderId(): string {
  return `ord_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Generate unique amount with micro-cents for payment matching
export function generateUniqueAmount(baseAmount: number): number {
  // Add random micro-cents (0.000001 to 0.009999)
  const microCents = Math.floor(Math.random() * 10000) / 1000000;
  return Math.round((baseAmount + microCents) * 1000000) / 1000000;
}

// Create a new order
export async function createOrder(order: Omit<Order, 'id' | 'createdAt' | 'status' | 'uniqueAmount'>): Promise<Order> {
  const id = generateOrderId();
  const uniqueAmount = generateUniqueAmount(order.subtotal);

  const newOrder: Order = {
    ...order,
    id,
    uniqueAmount,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // Store order
  await redis.set(`${ORDER_PREFIX}${id}`, JSON.stringify(newOrder));

  // Add to order index (sorted by creation time)
  await redis.zadd(ORDER_INDEX, { score: Date.now(), member: id });

  // Index by amount for payment matching (amount as string key)
  const amountKey = `${AMOUNT_INDEX}${uniqueAmount.toFixed(6)}`;
  await redis.set(amountKey, id, { ex: 3600 }); // Expire after 1 hour

  return newOrder;
}

// Get order by ID
export async function getOrder(id: string): Promise<Order | null> {
  const data = await redis.get<string>(`${ORDER_PREFIX}${id}`);
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

// Update order
export async function updateOrder(id: string, updates: Partial<Order>): Promise<Order | null> {
  const order = await getOrder(id);
  if (!order) return null;

  const updatedOrder = { ...order, ...updates };
  await redis.set(`${ORDER_PREFIX}${id}`, JSON.stringify(updatedOrder));

  return updatedOrder;
}

// Update order status
export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  additionalData?: Partial<Order>
): Promise<Order | null> {
  return updateOrder(id, { status, ...additionalData });
}

// Find order by payment amount (for webhook matching)
export async function findOrderByAmount(amount: number): Promise<Order | null> {
  // Look for exact match with 6 decimal precision
  const amountKey = `${AMOUNT_INDEX}${amount.toFixed(6)}`;
  const orderId = await redis.get<string>(amountKey);

  if (orderId) {
    return getOrder(orderId);
  }

  // Try with slight variations (±0.000001) for floating point issues
  for (const delta of [0.000001, -0.000001, 0.000002, -0.000002]) {
    const variantKey = `${AMOUNT_INDEX}${(amount + delta).toFixed(6)}`;
    const variantOrderId = await redis.get<string>(variantKey);
    if (variantOrderId) {
      return getOrder(variantOrderId);
    }
  }

  return null;
}

// List all orders (most recent first)
export async function listOrders(limit: number = 50): Promise<Order[]> {
  // Get order IDs sorted by creation time (most recent first)
  const orderIds = await redis.zrange(ORDER_INDEX, 0, limit - 1, { rev: true });

  if (!orderIds || orderIds.length === 0) return [];

  // Fetch all orders
  const orders: Order[] = [];
  for (const id of orderIds) {
    const order = await getOrder(id as string);
    if (order) orders.push(order);
  }

  return orders;
}

// Get orders by status
export async function getOrdersByStatus(status: OrderStatus, limit: number = 50): Promise<Order[]> {
  const allOrders = await listOrders(limit * 2); // Get more to filter
  return allOrders.filter(o => o.status === status).slice(0, limit);
}

// Get pending orders (for polling)
export async function getPendingOrders(): Promise<Order[]> {
  return getOrdersByStatus('pending');
}

// Clean up expired amount indexes (call periodically)
export async function cleanupAmountIndexes(): Promise<void> {
  // Amount indexes have TTL, so they auto-expire
  // This function is here for future manual cleanup if needed
}

export { redis };
