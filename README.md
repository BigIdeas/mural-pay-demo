# Mural Pay Merchant Checkout

A merchant checkout application that accepts USDC payments on Polygon and automatically converts them to Colombian Pesos (COP) for bank withdrawal using Mural Pay.

**Live Demo**: [https://mural-pay-demo.netlify.app](https://mural-pay-demo.netlify.app)

## Features

- **Product Catalog**: Browse Colombian products with USDC prices
- **USDC Checkout**: Generate unique payment amounts for automatic matching
- **Payment Detection**: Webhooks + polling for reliable payment detection
- **Auto-Conversion**: Automatic USDC to COP conversion at live rates
- **Auto-Payout**: Funds sent to Colombian bank account upon payment
- **Merchant Dashboard**: Track orders, payments, and payouts in real-time

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Upstash Redis (serverless)
- **Payments**: Mural Pay API (sandbox)

## Architecture

```
Customer UI → Next.js API → Mural Pay API
     ↓              ↓              ↓
  Products    Order Storage   USDC Deposit
  Checkout    (Redis)        COP Payout
  Payment     Webhook Handler
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file (or use the existing one):

```env
# Mural Pay API Keys (from dashboard)
MURAL_API_KEY=your_api_key
MURAL_TRANSFER_API_KEY=your_transfer_key

# Deposit Address (from Mural dashboard)
MURAL_DEPOSIT_ADDRESS=0x...
NEXT_PUBLIC_DEPOSIT_ADDRESS=0x...

# Colombian Bank Payout (set up via API or dashboard)
MURAL_COUNTERPARTY_ID=xxx
MURAL_PAYOUT_METHOD_ID=xxx

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# App URL (update after deploy)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Route | Description |
|-------|-------------|
| `/` | Product catalog |
| `/checkout` | Cart review & checkout |
| `/pay/[orderId]` | Payment instructions with QR code |
| `/merchant` | Merchant dashboard |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/orders` | POST | Create new order |
| `/api/orders` | GET | List all orders |
| `/api/orders/[id]` | GET | Get single order |
| `/api/webhooks/mural` | POST | Mural webhook receiver |
| `/api/poll` | GET/POST | Manual payment polling |

## Payment Matching Strategy

Since Mural deposits are identified by amount + timing, we generate unique amounts:

```
Base Price: $25.00
Unique Amount: $25.001234 (random micro-cents added)
```

This allows automatic matching when the exact amount is received.

### Known Limitations

1. **Wrong Amount**: If customer sends wrong amount, no automatic match
2. **Split Payments**: Partial payments won't be detected
3. **Duplicate Amounts**: Race condition if two orders have same amount within milliseconds
4. **Amount Expiry**: Unique amounts expire after 1 hour in Redis
5. **COP Payout Setup**: The Mural staging API does not expose the bank list endpoint required to create Colombian payout methods programmatically. A counterparty was created successfully, but the payout method requires manual setup through Mural support or the dashboard. The auto-payout code is implemented and ready once `MURAL_PAYOUT_METHOD_ID` is configured.

## Webhook Setup

Register your webhook URL with Mural:

```bash
curl -X POST https://api-staging.muralpay.com/api/webhooks \
  -H "Authorization: Bearer $MURAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/api/webhooks/mural",
    "categories": ["MURAL_ACCOUNT_BALANCE_ACTIVITY", "PAYOUT_REQUEST"]
  }'
```

Then enable the webhook (note: use `/status` endpoint with `ACTIVE`):

```bash
curl -X PATCH https://api-staging.muralpay.com/api/webhooks/{webhookId}/status \
  -H "Authorization: Bearer $MURAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "ACTIVE"}'
```

Test with a sample event:

```bash
curl -X POST https://api-staging.muralpay.com/api/webhooks/{webhookId}/send \
  -H "Authorization: Bearer $MURAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event": {"type": "categoryTest", "category": "MURAL_ACCOUNT_BALANCE_ACTIVITY"}}'
```

## Colombian Bank Payout Setup

To enable auto-payout, create a counterparty and payout method:

### 1. Create Counterparty

```bash
curl -X POST https://api-staging.muralpay.com/api/counterparties \
  -H "Authorization: Bearer $MURAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Merchant Payout",
    "type": "individual"
  }'
```

### 2. Add Payout Method (Colombian Bank)

> **Note**: This step requires a `bankId` from the bank list API, which is not exposed in the staging environment. Contact Mural support or use the dashboard to complete this setup.

```bash
curl -X POST https://api-staging.muralpay.com/api/counterparties/{id}/payout-methods \
  -H "Authorization: Bearer $MURAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "bank_transfer",
    "currency": "COP",
    "bankId": "xxx",
    "bankDetails": {
      "accountNumber": "123456789",
      "accountType": "SAVINGS",
      "documentType": "CC",
      "documentNumber": "1234567890"
    }
  }'
```

### 3. Update Environment

Add the returned IDs to your `.env`:

```env
MURAL_COUNTERPARTY_ID=cp_xxxxx
MURAL_PAYOUT_METHOD_ID=pm_xxxxx
```

## Deployment

### Netlify

1. Connect your GitHub repository
2. Set environment variables in Netlify dashboard
3. Deploy

Build settings:
- Build command: `npm run build`
- Publish directory: `.next`

### After Deployment

1. Update `NEXT_PUBLIC_APP_URL` with your Netlify URL
2. Register webhook with Mural using your production URL

## Testing

### Manual E2E Test

1. Add products to cart
2. Create order at checkout
3. Note the unique USDC amount
4. Send testnet USDC to deposit address (from Mural dashboard)
5. Verify payment detection (webhook or poll)
6. Check payout status in merchant dashboard

### Simulate Webhook (Local)

```bash
curl -X POST http://localhost:3000/api/webhooks/mural \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "account_credited",
    "payload": {
      "amount": "25.001234",
      "tokenSymbol": "USDC"
    }
  }'
```

### Simulate Webhook (Production)

```bash
curl -X POST https://mural-pay-demo.netlify.app/api/webhooks/mural \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "account_credited",
    "payload": {
      "amount": "25.001234",
      "tokenSymbol": "USDC"
    }
  }'
```

### Trigger Polling

```bash
curl http://localhost:3000/api/poll
# or
curl -X POST https://mural-pay-demo.netlify.app/api/poll
```

## Project Structure

```
/src
  /app
    /page.tsx                    # Product catalog
    /checkout/page.tsx           # Cart/checkout
    /pay/[orderId]/page.tsx      # Payment instructions
    /merchant/page.tsx           # Dashboard
    /api
      /orders/route.ts           # Order CRUD
      /orders/[id]/route.ts      # Single order
      /webhooks/mural/route.ts   # Webhook handler
      /poll/route.ts             # Backup polling
  /components
    /ui/                         # shadcn components
    /cart-provider.tsx           # Cart context
    /header.tsx                  # Navigation
  /lib
    /mural.ts                    # Mural API client
    /redis.ts                    # Redis operations
    /types.ts                    # TypeScript types
    /products.ts                 # Product catalog
```

## License

MIT
