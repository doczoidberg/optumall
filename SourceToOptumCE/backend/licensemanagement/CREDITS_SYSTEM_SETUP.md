# Credits System Setup Guide

This document explains how to set up and use the credits/payment system for account purchases.

## Overview

The credits system allows organizations to purchase credits via Stripe and use them for VM provisioning, licenses, or other billable resources.

## Database Structure

Three new tables have been created:

1. **`account_credits`** - Tracks credit balance per account
   - `account_id`: Which organization owns the credits
   - `credits`: Total credits purchased
   - `credits_used`: Credits consumed
   - `available_credits = credits - credits_used`

2. **`credit_transactions`** - Purchase history
   - Tracks all credit purchases via Stripe
   - Stores Stripe session IDs and payment intents
   - Status: pending, completed, failed, refunded

3. **`credit_usage_logs`** - Usage tracking
   - Logs when credits are consumed
   - Tracks which resource (VM, license, etc.) consumed them

## Installation Steps

### 1. Install Stripe PHP Library

```bash
cd /c/optum/sourcetooptumce/backend/licensemanagement
composer require stripe/stripe-php
```

### 2. Configure Environment Variables

Update your `.env` file with Stripe credentials:

```env
# Stripe Configuration
STRIPE_PUBLIC_KEY=pk_test_YOUR_PUBLISHABLE_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
```

Get these keys from: https://dashboard.stripe.com/test/apikeys

### 3. Run Database Migration

```bash
php artisan migrate --path=database/migrations/2025_01_10_000000_create_credits_tables.php
```

If the migration fails due to existing tables:
```sql
-- Manually drop and recreate
DROP TABLE IF EXISTS credit_usage_logs;
DROP TABLE IF EXISTS credit_transactions;
DROP TABLE IF EXISTS account_credits;
```

Then run the migration again.

### 4. Set Up Stripe Webhook

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: `https://yourdomain.com/api/stripe/webhook`
4. Select event: `checkout.session.completed`
5. Copy the "Signing secret" (starts with `whsec_...`)
6. Add it to your `.env` file as `STRIPE_WEBHOOK_SECRET`

## API Endpoints

### For License Management Tool (Vue/PHP Frontend)

**Authentication Required (JWT)**

```
GET  /api/credits/packages                    - List available credit packages
GET  /api/credits/balance/{accountId}         - Get credit balance
GET  /api/credits/transactions/{accountId}    - Get purchase history
POST /api/credits/checkout                    - Create Stripe checkout session
POST /api/credits/add-manual                  - Manually add credits (superadmin only)
```

### For OptumAdmin (Angular App)

**API Key Required**

```
GET /api/optumadmin/credits/balance/{accountId}      - Get credit balance
GET /api/optumadmin/credits/transactions/{accountId} - Get transaction history
```

### Webhook (No Auth)

```
POST /api/stripe/webhook - Stripe webhook handler
```

## Credit Packages

Default packages (configurable in `CreditsController.php`):

| Package      | Credits | Price   |
|--------------|---------|---------|
| Starter      | 100     | $10.00  |
| Professional | 500     | $45.00  |
| Enterprise   | 1,000   | $80.00  |
| Ultimate     | 5,000   | $350.00 |

## Usage Examples

### 1. Purchase Credits (License Management Tool)

```javascript
// In Vue component
async buyCredits(packageKey) {
  const response = await axios.post('/api/credits/checkout', {
    package: packageKey,      // 'starter', 'professional', etc.
    account_id: this.accountId
  });

  // Redirect to Stripe Checkout
  window.location.href = response.data.data.url;
}
```

### 2. Check Credit Balance

```javascript
async checkBalance() {
  const response = await axios.get(`/api/credits/balance/${this.accountId}`);
  console.log('Available credits:', response.data.data.available_credits);
}
```

### 3. Deduct Credits (When Creating VM or License)

```php
use App\Models\AccountCredit;
use App\Models\CreditUsageLog;

// Check if account has enough credits
$credits = AccountCredit::where('account_id', $accountId)->first();

if (!$credits || $credits->getAvailableCreditsAttribute() < $requiredCredits) {
    throw new Exception('Insufficient credits');
}

// Deduct credits
$credits->deductCredits($requiredCredits);

// Log the usage
CreditUsageLog::create([
    'account_id' => $accountId,
    'resource_type' => 'vm',
    'resource_id' => $vmId,
    'credits_used' => $requiredCredits,
    'description' => 'VM provisioning for ' . $vmName
]);
```

## Frontend Implementation

### License Management Tool (Vue.js)

Create a credits page at `frontend/src/views/Credits.vue`:

```vue
<template>
  <div>
    <h2>Buy Credits</h2>

    <!-- Current Balance -->
    <div class="balance-card">
      <h3>Available Credits: {{ balance.available_credits }}</h3>
      <p>Total Purchased: {{ balance.credits }}</p>
      <p>Used: {{ balance.credits_used }}</p>
    </div>

    <!-- Credit Packages -->
    <div class="packages">
      <div v-for="(pkg, key) in packages" :key="key" class="package-card">
        <h4>{{ pkg.name }}</h4>
        <p>{{ pkg.credits }} Credits</p>
        <p>${{ pkg.price }}</p>
        <button @click="buyPackage(key)">Buy Now</button>
      </div>
    </div>

    <!-- Transaction History -->
    <div class="transactions">
      <h3>Purchase History</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Package</th>
            <th>Credits</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tx in transactions" :key="tx.id">
            <td>{{ tx.created_date }}</td>
            <td>{{ tx.package_name }}</td>
            <td>{{ tx.credits }}</td>
            <td>${{ tx.amount }}</td>
            <td>{{ tx.status }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      packages: {},
      balance: {},
      transactions: []
    }
  },
  async mounted() {
    await this.loadPackages();
    await this.loadBalance();
    await this.loadTransactions();
  },
  methods: {
    async loadPackages() {
      const response = await this.$http.get('/api/credits/packages');
      this.packages = response.data.data;
    },
    async loadBalance() {
      const accountId = this.$store.state.user.account_id;
      const response = await this.$http.get(`/api/credits/balance/${accountId}`);
      this.balance = response.data.data;
    },
    async loadTransactions() {
      const accountId = this.$store.state.user.account_id;
      const response = await this.$http.get(`/api/credits/transactions/${accountId}`);
      this.transactions = response.data.data;
    },
    async buyPackage(packageKey) {
      const accountId = this.$store.state.user.account_id;
      const response = await this.$http.post('/api/credits/checkout', {
        package: packageKey,
        account_id: accountId
      });

      // Redirect to Stripe Checkout
      window.location.href = response.data.data.url;
    }
  }
}
</script>
```

Add the route:
```javascript
// router/index.js
{
  path: '/credits',
  name: 'Credits',
  component: () => import('../views/Credits.vue'),
  meta: { requiresAuth: true }
}
```

### OptumAdmin (Angular)

Implementation already added - "Buy Credits" button appears on organization account pages.

## Testing

### Test Mode (Stripe Test Keys)

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Any future expiry date, any CVC

### Webhook Testing

Use Stripe CLI:
```bash
stripe listen --forward-to localhost:8000/api/stripe/webhook
stripe trigger checkout.session.completed
```

## Security Notes

1. **Never expose Stripe secret keys** in frontend code
2. **Validate webhook signatures** to prevent fake payment notifications
3. **Check credit balance** before allowing resource creation
4. **Log all credit usage** for audit trails
5. **Use HTTPS in production** for Stripe webhooks

## Troubleshooting

### Webhook Not Working

- Check Stripe webhook logs in dashboard
- Verify STRIPE_WEBHOOK_SECRET is correct
- Ensure webhook URL is publicly accessible
- Check Laravel logs: `tail -f storage/logs/laravel.log`

### Credits Not Added After Payment

- Check credit_transactions table for status
- Look for errors in Laravel logs
- Verify webhook received checkout.session.completed event
- Check account_credits table was updated

### Migration Fails

- Check database user has CREATE TABLE permissions
- Verify account table exists first
- Remove foreign key constraints if needed

## Production Checklist

- [ ] Replace test Stripe keys with live keys
- [ ] Update success/cancel URLs to production domain
- [ ] Set up production webhook endpoint
- [ ] Test webhook with live events
- [ ] Set up monitoring/alerts for failed payments
- [ ] Configure email notifications for purchases
- [ ] Set up proper error logging
- [ ] Review and adjust credit packages and pricing
- [ ] Add terms of service link to checkout
