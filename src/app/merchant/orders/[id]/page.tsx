'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const POLL_INTERVAL = 5000;

function StatusBadge({ status }: { status: Order['status'] }) {
  const variants: Record<Order['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className?: string }> = {
    pending: { variant: 'secondary', label: 'Awaiting Payment' },
    paid: { variant: 'default', label: 'Payment Received', className: 'bg-green-600' },
    payout_pending: { variant: 'outline', label: 'Processing Payout' },
    payout_completed: { variant: 'default', label: 'Payout Complete', className: 'bg-green-600' },
    failed: { variant: 'destructive', label: 'Failed' },
  };

  const { variant, label, className } = variants[status] || variants.pending;

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

function LoadingSpinner() {
  return (
    <div className="container mx-auto px-4 py-16 flex justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Loading order...</p>
      </div>
    </div>
  );
}

export default function MerchantOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/${resolvedParams.id}`);
      if (!response.ok) {
        throw new Error('Order not found');
      }
      const data = await response.json();
      setOrder(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [resolvedParams.id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Delay showing loading state to prevent flash
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowLoading(true), 150);
      return () => clearTimeout(timer);
    } else {
      setShowLoading(false);
    }
  }, [loading]);

  // Poll for updates while not completed
  useEffect(() => {
    if (!order || order.status === 'payout_completed' || order.status === 'failed') return;

    const interval = setInterval(fetchOrder, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [order, fetchOrder]);

  if (loading) {
    if (!showLoading) return null;
    return <LoadingSpinner />;
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Order Not Found</h1>
        <p className="text-muted-foreground mb-8">{error || 'This order does not exist.'}</p>
        <Link href="/merchant">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/merchant" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Dashboard
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Order Details</CardTitle>
              <CardDescription className="font-mono">
                #{order.id.slice(-8).toUpperCase()}
              </CardDescription>
            </div>
            <StatusBadge status={order.status} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status Timeline */}
          <div className="space-y-3">
            <h3 className="font-medium">Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${order.createdAt ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span>Order created</span>
                <span className="text-muted-foreground ml-auto">
                  {new Date(order.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${order.paidAt ? 'bg-green-500' : order.status === 'pending' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300'}`} />
                <span>Payment received</span>
                {order.paidAt && (
                  <span className="text-muted-foreground ml-auto">
                    {new Date(order.paidAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${order.status === 'payout_completed' ? 'bg-green-500' : order.status === 'payout_pending' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300'}`} />
                <span>Payout completed</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Order Items */}
          <div className="space-y-3">
            <h3 className="font-medium">Items</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.name} x{item.quantity}</span>
                  <span>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-medium pt-2 border-t">
                <span>Subtotal</span>
                <span>${order.subtotal.toFixed(2)} USDC</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Payment Details */}
          <div className="space-y-3">
            <h3 className="font-medium">Payment Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Amount</span>
                <span className="font-mono">{order.uniqueAmount.toFixed(6)} USDC</span>
              </div>
              {order.transactionHash && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction</span>
                  <span className="font-mono text-xs truncate max-w-[200px]">{order.transactionHash}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payout Details */}
          {(order.copAmount || order.payoutId) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-medium">Payout Details</h3>
                <div className="space-y-2 text-sm">
                  {order.exchangeRate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Exchange Rate</span>
                      <span>1 USDC = {order.exchangeRate.toLocaleString()} COP</span>
                    </div>
                  )}
                  {order.copAmount && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">COP Amount</span>
                      <span className="font-medium text-green-600">
                        {order.copAmount.toLocaleString()} COP
                      </span>
                    </div>
                  )}
                  {order.payoutId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payout ID</span>
                      <span className="font-mono text-xs">{order.payoutId}</span>
                    </div>
                  )}
                  {order.payoutStatus && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payout Status</span>
                      <Badge variant="outline">{order.payoutStatus}</Badge>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Polling indicator for pending orders */}
          {order.status === 'pending' && (
            <div className="text-center text-sm text-muted-foreground pt-4 border-t">
              <div className="flex items-center justify-center gap-2">
                <span className="animate-pulse text-yellow-500">●</span>
                Waiting for customer payment...
              </div>
            </div>
          )}

          <div className="pt-4">
            <Link href="/merchant">
              <Button variant="outline" className="w-full">Back to Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
