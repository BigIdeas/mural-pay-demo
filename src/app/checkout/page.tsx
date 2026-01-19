'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/components/cart-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { toast } from 'sonner';

export default function CheckoutPage() {
  const { items, updateQuantity, removeItem, total, clearCart } = useCart();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (items.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
          subtotal: total,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create order');
      }

      const order = await response.json();
      setIsRedirecting(true);
      clearCart();
      router.push(`/pay/${order.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      setError(message);
      toast.error(message);
      setIsLoading(false);
    }
  };

  // Show nothing while redirecting to prevent flash of empty cart
  if (isRedirecting) {
    return null;
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Your Cart is Empty</h1>
        <p className="text-muted-foreground mb-8">Add some products to get started.</p>
        <Link href="/">
          <Button>Browse Products</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-4">
              <div className="w-16 h-16 relative bg-muted rounded overflow-hidden flex-shrink-0">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-grow">
                <h3 className="font-medium">{item.name}</h3>
                <p className="text-sm text-muted-foreground">
                  ${item.price.toFixed(2)} USDC
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                >
                  -
                </Button>
                <span className="w-8 text-center">{item.quantity}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                >
                  +
                </Button>
              </div>
              <div className="w-24 text-right font-medium">
                ${(item.price * item.quantity).toFixed(2)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeItem(item.id)}
                className="text-red-500 hover:text-red-700"
              >
                Remove
              </Button>
            </div>
          ))}

          <Separator />

          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total</span>
            <span className="text-green-600">${total.toFixed(2)} USDC</span>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-4">
          {error && (
            <div className="w-full p-3 bg-red-50 text-red-600 rounded text-sm">
              {error}
            </div>
          )}
          <Button
            onClick={handleCheckout}
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            {isLoading ? 'Creating Order...' : 'Place Order'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            You will receive a unique payment address. Payment is detected automatically.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
