'use client';

import Image from 'next/image';
import { products } from '@/lib/products';
import { useCart } from '@/components/cart-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const { addItem } = useCart();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Colombian Marketplace</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Authentic Colombian products. Pay with USDC on Polygon, we handle the rest.
          Your payment is automatically converted to Colombian Pesos for local bank withdrawal.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded">USDC</span>
          <span>→</span>
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">COP</span>
          <span className="ml-2">Powered by Mural Pay</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="aspect-square relative bg-muted rounded-lg overflow-hidden mb-2">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </div>
              <CardTitle className="text-lg">{product.name}</CardTitle>
              <CardDescription className="text-sm line-clamp-2">
                {product.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-2xl font-bold text-green-600">
                ${product.price.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground ml-1">USDC</span>
              </p>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => addItem(product)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Add to Cart
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-16 text-center border-t pt-8">
        <h2 className="text-xl font-semibold mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-green-600 font-bold">1</span>
            </div>
            <h3 className="font-medium mb-1">Add Products</h3>
            <p className="text-sm text-muted-foreground">Browse and add items to your cart</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-green-600 font-bold">2</span>
            </div>
            <h3 className="font-medium mb-1">Pay with USDC</h3>
            <p className="text-sm text-muted-foreground">Send USDC to the provided Polygon address</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-green-600 font-bold">3</span>
            </div>
            <h3 className="font-medium mb-1">Auto-Convert & Payout</h3>
            <p className="text-sm text-muted-foreground">We convert to COP and send to Colombian bank</p>
          </div>
        </div>
      </div>
    </div>
  );
}
