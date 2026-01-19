# Mural Pay Merchant Checkout

A merchant checkout application that accepts USDC payments on Polygon and automatically converts them to Colombian Pesos (COP) for bank withdrawal using the Mural Pay API.

**Live Demo**: [https://mural-pay-demo.netlify.app](https://mural-pay-demo.netlify.app)

## Features

- **Product Catalog**: Browse Colombian products with USDC prices
- **USDC Checkout**: Generate unique payment amounts for automatic matching
- **Payment Detection**: Real-time via webhooks, with polling backup
- **Auto-Conversion**: USDC to COP conversion at live exchange rates
- **Auto-Payout**: Automatic transfer to Colombian bank account
- **Merchant Dashboard**: Track orders, payments, and payout status

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Upstash Redis (serverless)
- **Payments**: Mural Pay API (sandbox)

## How It Works

### Payment Flow

```
1. Customer browses products and adds to cart
2. At checkout, order is created with unique USDC amount (e.g., $25.001234)
3. Customer sees payment page with deposit address and QR code
4. Customer sends exact USDC amount to deposit address
5. Mural detects payment → fires webhook → order marked as paid
6. Auto-payout triggers: USDC → COP → Colombian bank
7. Merchant sees updated status in dashboard
```

### Unique Amount Matching

Since Mural deposits are identified by amount (not memo/reference), we generate unique amounts by adding random micro-cents:

```
Base Price: $25.00 → Unique Amount: $25.001234
```

This allows automatic matching when the exact amount is received. Amounts are reserved in Redis for 1 hour to prevent collisions, then released for reuse.

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/BigIdeas/mural-pay-demo.git
cd mural-pay-demo
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```env
# Mural Pay (from dashboard.muralpay.com)
MURAL_API_KEY=your_api_key
MURAL_TRANSFER_API_KEY=your_transfer_key
MURAL_ACCOUNT_ID=your_account_id
MURAL_DEPOSIT_ADDRESS=0x...
NEXT_PUBLIC_DEPOSIT_ADDRESS=0x...

# Upstash Redis (from console.upstash.com)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# COP Payout (optional - see Limitations)
MURAL_COUNTERPARTY_ID=xxx
MURAL_PAYOUT_METHOD_ID=xxx
```

### 3. Register Webhook with Mural

```bash
# Create webhook
curl -X POST https://api-staging.muralpay.com/api/webhooks \
  -H "Authorization: Bearer $MURAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-app.netlify.app/api/webhooks/mural", "categories": ["MURAL_ACCOUNT_BALANCE_ACTIVITY"]}'

# Enable it (replace {webhookId} with returned id)
curl -X PATCH https://api-staging.muralpay.com/api/webhooks/{webhookId}/status \
  -H "Authorization: Bearer $MURAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "ACTIVE"}'
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Testing

### E2E Test Flow

1. **Create an order**: Add products to cart → Checkout → Note the unique USDC amount
2. **Simulate payment**: Use curl to simulate the webhook Mural would send:

```bash
# Replace AMOUNT with your order's unique amount (e.g., 37.006045)
curl -X POST https://mural-pay-demo.netlify.app/api/webhooks/mural \
  -H "Content-Type: application/json" \
  -d '{"eventType": "account_credited", "payload": {"amount": "AMOUNT", "tokenSymbol": "USDC"}}'
```

3. **Verify**: Check the merchant dashboard - order should show as "Paid"

### Real Payment Test

To test with actual USDC on the blockchain:
1. Create an order and note the unique amount
2. Get testnet USDC from [Circle Faucet](https://faucet.circle.com/) into an external wallet (e.g., MetaMask)
3. Send exact USDC amount FROM external wallet TO the deposit address (`0xd4e3bc48E59b3Cad1A038a4014A1299bD8D038DA`)
4. Mural detects incoming funds → fires `account_credited` webhook → order marked paid

> **Note**: Mural's "Move money → Pay" sends funds OUT of your account. The webhook fires on incoming funds, so you need an external wallet to send TO your deposit address.

### Merchant Dashboard

Login at `/merchant` with demo credentials: `admin` / `mural123`

## Known Limitations

### Payment Matching
- **Wrong amount**: If customer sends incorrect amount, no automatic match occurs
- **Split payments**: Partial payments won't be detected
- **Duplicate amounts**: Rare race condition if two orders get same micro-cents within milliseconds

### COP Bank Payout
The Mural staging API does not expose the bank list endpoint required to create Colombian payout methods programmatically. The auto-payout code is fully implemented and ready - it just needs `MURAL_PAYOUT_METHOD_ID` configured once the payout method is created via Mural support or the production dashboard.

## Project Structure

```
/src
  /app
    /page.tsx                    # Product catalog
    /checkout/page.tsx           # Cart review
    /pay/[orderId]/page.tsx      # Payment instructions
    /merchant/page.tsx           # Dashboard
    /api
      /orders/route.ts           # Order CRUD
      /webhooks/mural/route.ts   # Webhook handler
      /poll/route.ts             # Backup polling
  /components
    /cart-provider.tsx           # Cart context
    /header.tsx                  # Navigation
    /ui/                         # shadcn components
  /lib
    /mural.ts                    # Mural API client
    /redis.ts                    # Order storage
    /types.ts                    # TypeScript types
```

## Deployment

### Netlify

1. Connect GitHub repository in Netlify dashboard
2. Set environment variables
3. Deploy (build command: `npm run build`)

After deployment, update `NEXT_PUBLIC_APP_URL` and register webhook with production URL.

## License

MIT
