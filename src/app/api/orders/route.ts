import { NextResponse } from 'next/server';
import { createOrder, listOrders } from '@/lib/redis';
import { OrderItem } from '@/lib/types';

// POST /api/orders - Create new order
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, subtotal } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      );
    }

    if (typeof subtotal !== 'number' || subtotal <= 0) {
      return NextResponse.json(
        { error: 'Valid subtotal is required' },
        { status: 400 }
      );
    }

    // Validate items
    const validatedItems: OrderItem[] = items.map((item: OrderItem) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    const order = await createOrder({
      items: validatedItems,
      subtotal,
    });

    console.log(`Order created: ${order.id}, amount: ${order.uniqueAmount} USDC`);

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

// GET /api/orders - List all orders (for merchant dashboard)
export async function GET() {
  try {
    const orders = await listOrders(100);
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error listing orders:', error);
    return NextResponse.json(
      { error: 'Failed to list orders' },
      { status: 500 }
    );
  }
}
