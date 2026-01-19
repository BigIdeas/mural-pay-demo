'use client';

import Link from 'next/link';
import { useCart } from './cart-provider';
import { Button } from './ui/button';

export function Header() {
  const { itemCount } = useCart();

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="font-semibold text-lg">Mural Pay Shop</span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link href="/merchant" className="text-sm text-muted-foreground hover:text-foreground">
            Merchant
          </Link>
          <Link href="/checkout">
            <Button variant="outline" size="sm" className="relative">
              Cart
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-green-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
