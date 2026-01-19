import { Product } from './types';

export const products: Product[] = [
  {
    id: 'coffee-beans',
    name: 'Colombian Coffee Beans',
    description: 'Premium single-origin Arabica beans from Huila region. 500g bag.',
    price: 24.99,
    image: '/products/coffee.svg',
  },
  {
    id: 'emerald-pendant',
    name: 'Emerald Pendant',
    description: 'Handcrafted silver pendant with genuine Colombian emerald.',
    price: 149.99,
    image: '/products/emerald.svg',
  },
  {
    id: 'panela-pack',
    name: 'Organic Panela Pack',
    description: 'Traditional unrefined cane sugar. Pack of 6 blocks (3kg total).',
    price: 18.50,
    image: '/products/panela.svg',
  },
  {
    id: 'aguardiente',
    name: 'Aguardiente Antioqueño',
    description: 'Classic Colombian anise-flavored spirit. 750ml bottle.',
    price: 32.00,
    image: '/products/aguardiente.svg',
  },
];

export function getProduct(id: string): Product | undefined {
  return products.find(p => p.id === id);
}
