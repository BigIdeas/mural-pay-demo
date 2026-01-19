import { NextResponse } from 'next/server';
import { getPendingOrders, updateOrderStatus, getOrder } from '@/lib/redis';
import { getAccountTransactions, createCopPayout, getFxRate } from '@/lib/mural';

// Poll Mural for recent transactions and match to pending orders
export async function POST() {
  try {
    const pendingOrders = await getPendingOrders();

    if (pendingOrders.length === 0) {
      return NextResponse.json({ checked: 0, matched: 0, message: 'No pending orders' });
    }

    const accountId = process.env.MURAL_ACCOUNT_ID;
    if (!accountId || accountId === 'xxx') {
      return NextResponse.json({
        checked: pendingOrders.length,
        matched: 0,
        message: 'MURAL_ACCOUNT_ID not configured. Use webhook simulation for testing.',
      });
    }

    // Fetch recent transactions from the account
    const { results: transactions } = await getAccountTransactions(accountId, { limit: 50 });
    const deposits = transactions.filter(tx => tx.type === 'deposit' || tx.type === 'credit');

    let matched = 0;
    for (const order of pendingOrders) {
      const match = deposits.find(d => Math.abs(parseFloat(d.amount) - order.uniqueAmount) < 0.000001);
      if (match) {
        await processPayment(order.id, match.transactionHash);
        matched++;
      }
    }

    return NextResponse.json({ checked: pendingOrders.length, matched });
  } catch (error) {
    console.error('Polling error:', error);
    return NextResponse.json(
      { error: 'Polling failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}

// Process a matched payment
async function processPayment(orderId: string, transactionHash?: string) {
  const order = await getOrder(orderId);
  if (!order || order.status !== 'pending') return;

  await updateOrderStatus(order.id, 'paid', {
    paidAt: new Date().toISOString(),
    transactionHash,
  });

  const counterpartyId = process.env.MURAL_COUNTERPARTY_ID;
  const payoutMethodId = process.env.MURAL_PAYOUT_METHOD_ID;

  if (counterpartyId && counterpartyId !== 'xxx' && payoutMethodId && payoutMethodId !== 'xxx') {
    try {
      const { rate } = await getFxRate('USDC', 'COP');
      const copAmount = Math.round(order.uniqueAmount * rate * 100) / 100;

      await updateOrderStatus(order.id, 'payout_pending', { copAmount, exchangeRate: rate });

      const payout = await createCopPayout(order.uniqueAmount, counterpartyId, payoutMethodId, `Order ${order.id}`);

      await updateOrderStatus(order.id, 'payout_completed', { payoutId: payout.id, payoutStatus: payout.status });
    } catch (err) {
      console.error(`Payout failed for order ${order.id}:`, err);
    }
  }
}
