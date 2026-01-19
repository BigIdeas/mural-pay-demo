import { NextResponse } from 'next/server';
import { findOrderByAmount, updateOrderStatus } from '@/lib/redis';
import { createCopPayout, getFxRate } from '@/lib/mural';

// Mural webhook event types we care about
const PAYMENT_EVENTS = ['account_credited', 'deposit.completed', 'transfer.completed'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    const eventType = body.eventType || body.event || body.type;
    const payload = body.payload || body.data || body;

    // Only process payment-related events
    if (!PAYMENT_EVENTS.some(e => eventType?.includes(e) || eventType === e)) {
      console.log(`Ignoring event type: ${eventType}`);
      return NextResponse.json({ received: true, processed: false });
    }

    // Extract amount from payload (Mural format may vary)
    const amount = parseFloat(
      payload.amount ||
      payload.value ||
      payload.tokenAmount ||
      body.amount ||
      '0'
    );

    if (!amount || amount <= 0) {
      console.log('No valid amount in payload');
      return NextResponse.json({ received: true, processed: false, reason: 'no_amount' });
    }

    console.log(`Processing payment: ${amount} USDC`);

    // Find matching order by amount
    const order = await findOrderByAmount(amount);

    if (!order) {
      console.log(`No matching order found for amount: ${amount}`);
      return NextResponse.json({ received: true, processed: false, reason: 'no_matching_order' });
    }

    if (order.status !== 'pending') {
      console.log(`Order ${order.id} already processed (status: ${order.status})`);
      return NextResponse.json({ received: true, processed: false, reason: 'already_processed' });
    }

    // Extract transaction hash if available
    const transactionHash = payload.transactionHash || payload.txHash || payload.hash || body.transactionHash;

    // Update order to paid
    console.log(`Marking order ${order.id} as paid`);
    await updateOrderStatus(order.id, 'paid', {
      paidAt: new Date().toISOString(),
      transactionHash,
    });

    // Trigger auto-payout to Colombian bank
    const counterpartyId = process.env.MURAL_COUNTERPARTY_ID;
    const payoutMethodId = process.env.MURAL_PAYOUT_METHOD_ID;

    if (counterpartyId && counterpartyId !== 'xxx' && payoutMethodId && payoutMethodId !== 'xxx') {
      try {
        console.log(`Triggering COP payout for order ${order.id}`);

        // Get exchange rate
        const { rate } = await getFxRate('USDC', 'COP');
        const copAmount = Math.round(order.uniqueAmount * rate * 100) / 100;

        // Update order with payout info
        await updateOrderStatus(order.id, 'payout_pending', {
          copAmount,
          exchangeRate: rate,
        });

        // Create and execute payout
        const payout = await createCopPayout(
          order.uniqueAmount,
          counterpartyId,
          payoutMethodId,
          `Order ${order.id}`
        );

        console.log(`Payout created: ${payout.id}`);

        // Update order with payout completion
        await updateOrderStatus(order.id, 'payout_completed', {
          payoutId: payout.id,
          payoutStatus: payout.status,
        });

        return NextResponse.json({
          received: true,
          processed: true,
          orderId: order.id,
          payoutId: payout.id,
        });
      } catch (payoutError) {
        console.error('Payout failed:', payoutError);
        // Order is still marked as paid, just payout failed
        // In production, you'd want to retry or alert
        return NextResponse.json({
          received: true,
          processed: true,
          orderId: order.id,
          payoutError: payoutError instanceof Error ? payoutError.message : 'Payout failed',
        });
      }
    } else {
      console.log('No counterparty/payout method configured, skipping auto-payout');
      return NextResponse.json({
        received: true,
        processed: true,
        orderId: order.id,
        note: 'No payout method configured',
      });
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// GET endpoint for testing webhook is reachable
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Mural webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
