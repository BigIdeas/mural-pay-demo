'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import QRCode from 'qrcode';

const DEPOSIT_ADDRESS = process.env.NEXT_PUBLIC_DEPOSIT_ADDRESS || '0xd4e3bc48E59b3Cad1A038a4014A1299bD8D038DA';
const POLL_INTERVAL = 5000; // 5 seconds

function StatusBadge({ status }: { status: Order['status'] }) {
  const variants: Record<Order['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    pending: { variant: 'secondary', label: 'Awaiting Payment' },
    paid: { variant: 'default', label: 'Payment Received' },
    payout_pending: { variant: 'outline', label: 'Processing Payout' },
    payout_completed: { variant: 'default', label: 'Payout Complete' },
    failed: { variant: 'destructive', label: 'Failed' },
  };

  const { variant, label } = variants[status] || variants.pending;

  return (
    <Badge variant={variant} className={status === 'paid' || status === 'payout_completed' ? 'bg-green-600' : ''}>
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

export default function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const resolvedParams = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'address' | 'amount' | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/${resolvedParams.orderId}`);
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
  }, [resolvedParams.orderId]);

  // Generate QR code
  useEffect(() => {
    if (order?.uniqueAmount) {
      // Generate a simple QR code with the deposit address
      // In production, this could be an EIP-681 payment URI
      const paymentData = `ethereum:${DEPOSIT_ADDRESS}?value=${order.uniqueAmount}`;
      QRCode.toDataURL(paymentData, { width: 200, margin: 2 })
        .then(setQrCodeUrl)
        .catch(console.error);
    }
  }, [order?.uniqueAmount]);

  // Initial fetch
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

  // Poll for updates while pending
  useEffect(() => {
    if (!order || order.status !== 'pending') return;

    const interval = setInterval(fetchOrder, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [order, fetchOrder]);

  const copyToClipboard = async (text: string, type: 'address' | 'amount') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    // Only show loading spinner if it's been loading for > 150ms
    if (!showLoading) return null;
    return <LoadingSpinner />;
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Order Not Found</h1>
        <p className="text-muted-foreground mb-8">{error || 'This order does not exist.'}</p>
        <Link href="/">
          <Button>Back to Shop</Button>
        </Link>
      </div>
    );
  }

  const isPending = order.status === 'pending';
  const isCompleted = order.status === 'paid' || order.status === 'payout_completed';

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <StatusBadge status={order.status} />
          </div>
          <CardTitle className="text-2xl">
            {isPending ? 'Complete Your Payment' : isCompleted ? 'Payment Confirmed!' : 'Order Status'}
          </CardTitle>
          <CardDescription>
            Order #{order.id.slice(-8).toUpperCase()}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {isPending && (
            <>
              {/* QR Code */}
              <div className="flex justify-center">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="Payment QR Code" className="rounded-lg border" />
                ) : (
                  <Skeleton className="h-48 w-48" />
                )}
              </div>

              {/* Amount */}
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Send exactly</p>
                <p className="text-3xl font-bold text-green-600">
                  {order.uniqueAmount.toFixed(6)} USDC
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(order.uniqueAmount.toFixed(6), 'amount')}
                  className="mt-2"
                >
                  {copied === 'amount' ? 'Copied!' : 'Copy Amount'}
                </Button>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">To this Polygon address</p>
                <div className="bg-muted rounded-lg p-3 font-mono text-xs break-all text-center">
                  {DEPOSIT_ADDRESS}
                </div>
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(DEPOSIT_ADDRESS, 'address')}
                  >
                    {copied === 'address' ? 'Copied!' : 'Copy Address'}
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <strong>Important:</strong> Send the exact amount shown above. The unique amount helps us match your payment automatically.
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <span className="animate-pulse">●</span>
                  Waiting for payment...
                </div>
              </div>
            </>
          )}

          {order.status === 'paid' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg">Payment of <strong>{order.uniqueAmount.toFixed(6)} USDC</strong> received!</p>
              {order.transactionHash && (
                <p className="text-xs text-muted-foreground font-mono break-all">
                  TX: {order.transactionHash}
                </p>
              )}
              <div className="text-sm text-muted-foreground">
                Processing automatic payout to Colombian bank...
              </div>
            </div>
          )}

          {order.status === 'payout_pending' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-lg">Payout in progress...</p>
              {order.copAmount && order.exchangeRate && (
                <p className="text-sm text-muted-foreground">
                  Converting to ~{order.copAmount.toLocaleString()} COP (rate: {order.exchangeRate})
                </p>
              )}
            </div>
          )}

          {order.status === 'payout_completed' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-green-600">Payout Complete!</p>
              {order.copAmount && (
                <p className="text-2xl font-bold">
                  {order.copAmount.toLocaleString()} COP
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Funds have been sent to the Colombian bank account.
              </p>
            </div>
          )}

          <Separator />

          {/* Order Details */}
          <div className="space-y-2 text-sm">
            <h3 className="font-medium">Order Details</h3>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>{item.name} x{item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between font-medium pt-2 border-t">
              <span>Total</span>
              <span>${order.subtotal.toFixed(2)} USDC</span>
            </div>
          </div>

          <Link href="/">
            <Button variant="outline" className="w-full">Back to Shop</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
