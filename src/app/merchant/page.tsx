'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const POLL_INTERVAL = 10000; // 10 seconds

function StatusBadge({ status }: { status: Order['status'] }) {
  const variants: Record<Order['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className?: string }> = {
    pending: { variant: 'secondary', label: 'Pending' },
    paid: { variant: 'default', label: 'Paid', className: 'bg-green-600' },
    payout_pending: { variant: 'outline', label: 'Payout Pending' },
    payout_completed: { variant: 'default', label: 'Completed', className: 'bg-green-600' },
    failed: { variant: 'destructive', label: 'Failed' },
  };

  const { variant, label, className } = variants[status] || variants.pending;

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

function StatsCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function MerchantDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const router = useRouter();

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch('/api/orders');
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerPoll = async () => {
    setPolling(true);
    try {
      const response = await fetch('/api/poll', { method: 'POST' });
      const result = await response.json();
      if (result.matched > 0) {
        toast.success(`Found ${result.matched} payment(s)!`);
      } else if (result.message) {
        toast.info(result.message);
      }
      await fetchOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Poll failed');
    } finally {
      setPolling(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/merchant/login');
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Calculate stats
  const stats = {
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === 'pending').length,
    completedOrders: orders.filter((o) => o.status === 'payout_completed' || o.status === 'paid').length,
    totalVolume: orders
      .filter((o) => o.status !== 'pending' && o.status !== 'failed')
      .reduce((sum, o) => sum + o.uniqueAmount, 0),
    totalCop: orders
      .filter((o) => o.copAmount)
      .reduce((sum, o) => sum + (o.copAmount || 0), 0),
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Merchant Dashboard</h1>
          <p className="text-muted-foreground">Monitor orders, payments, and payouts</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={triggerPoll}
            disabled={polling}
          >
            {polling ? 'Checking...' : 'Check for Payments'}
          </Button>
          <Link href="/">
            <Button variant="outline">Shop</Button>
          </Link>
          <Button variant="ghost" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total Orders" value={stats.totalOrders} />
        <StatsCard
          title="Pending"
          value={stats.pendingOrders}
          subtitle="Awaiting payment"
        />
        <StatsCard
          title="Completed"
          value={stats.completedOrders}
          subtitle="Paid or withdrawn"
        />
        <StatsCard
          title="Volume (USDC)"
          value={`$${stats.totalVolume.toFixed(2)}`}
          subtitle={stats.totalCop > 0 ? `~${stats.totalCop.toLocaleString()} COP` : undefined}
        />
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>
            All orders from customers. Auto-refreshes every 10 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">No orders yet</p>
              <Link href="/">
                <Button>Create Test Order</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Amount (USDC)</TableHead>
                  <TableHead>COP Payout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">
                      {order.id.slice(-8).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      {order.items.map((item) => (
                        <div key={item.id} className="text-sm">
                          {item.name} x{item.quantity}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="font-medium">
                      ${order.uniqueAmount.toFixed(6)}
                    </TableCell>
                    <TableCell>
                      {order.copAmount ? (
                        <span className="text-green-600">
                          {order.copAmount.toLocaleString()} COP
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Link href={`/merchant/orders/${order.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Configuration Info */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deposit Address:</span>
            <code className="bg-muted px-2 py-1 rounded text-xs">
              {process.env.NEXT_PUBLIC_DEPOSIT_ADDRESS || '0xd4e3bc48E59b3Cad1A038a4014A1299bD8D038DA'}
            </code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Webhook URL:</span>
            <code className="bg-muted px-2 py-1 rounded text-xs">
              {process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/mural
            </code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Auto-payout:</span>
            <Badge variant={process.env.NEXT_PUBLIC_PAYOUT_ENABLED === 'true' ? 'default' : 'secondary'}>
              {process.env.NEXT_PUBLIC_PAYOUT_ENABLED === 'true' ? 'Enabled' : 'Configure MURAL_COUNTERPARTY_ID'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
