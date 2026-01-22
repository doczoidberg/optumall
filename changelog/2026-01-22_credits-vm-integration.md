# Changelog: Credits & VM Usage Integration

**Date:** 2026-01-22

## Summary

Connected the account credits system (MySQL/PHP) to the VM compute usage tracking (Firebase Cloud Functions). Replaced the Firestore-based customers view with the MySQL-backed accounts view in the Angular admin app.

---

## Changes

### 1. Angular App - Accounts/Credits View

**Files Modified:**
- `optumadmin/optumadmin/src/app/services/license-management-api.service.ts`
- `optumadmin/optumadmin/src/app/accounts/accounts.component.ts`
- `optumadmin/optumadmin/src/app/accounts/accounts.component.html`
- `optumadmin/optumadmin/src/app/app.component.html`
- `optumadmin/optumadmin/src/app/app-routing.module.ts`

**What changed:**
- Added `credits`, `credits_used`, `available_credits`, `last_purchase_date` to the `Account` interface
- Added a sortable "Credits" column to the accounts table with color-coded badges (green > 100, yellow 1-100, gray 0)
- Removed `/customers` and `/customer/:id` routes (Firestore-based)
- Removed "Customers/Credits" navigation link
- Renamed "Accounts" nav link to "Accounts/Credits"

---

### 2. Backend - Credits in Account API Responses

**Files Modified:**
- `SourceToOptumCE/backend/licensemanagement/app/Http/Controllers/OptumAdminController.php`

**What changed:**
- Added `AccountCredit` and `CreditUsageLog` model imports
- `getAllAccounts()` now includes `credits`, `credits_used`, `available_credits` per account
- `getAccount($id)` now includes credits + `last_purchase_date`

---

### 3. Backend - VM Usage Endpoints

**Files Modified:**
- `SourceToOptumCE/backend/licensemanagement/routes/web.php`
- `SourceToOptumCE/backend/licensemanagement/app/Http/Controllers/OptumAdminController.php`

**New API Endpoints (API key protected):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/optumadmin/vm/usage` | Record VM usage, deduct credits, log to `credit_usage_logs` |
| GET | `/api/optumadmin/vm/check-credits/{accountId}` | Check if account has sufficient credits for VM |
| GET | `/api/optumadmin/vm/usage-logs/{accountId}` | Get VM usage history for an account |

**POST `/api/optumadmin/vm/usage` request body:**
```json
{
  "account_id": 123,
  "credits_used": 15.5,
  "vm_id": "machine-abc",
  "vm_name": "optum-vm-1",
  "machine_type": "n2d-standard-4",
  "runtime_minutes": 45.2,
  "zone": "us-central1-a"
}
```

**Behavior:**
- Creates/finds `account_credits` record
- Logs usage to `credit_usage_logs` table with `resource_type = 'vm'`
- Increments `credits_used` on `account_credits`
- Flags overdraft in description if credits insufficient (still records usage)

---

### 4. Cloud Functions - VM Credit Integration

**Files Modified:**
- `optumadmin/optumadmin/functions/index.js`
- `optumadmin/optumadmin/functions/package.json` (firebase-admin 11.11.1, firebase-functions 4.9.0)

**New configuration:**
```
licenseapi.url = "http://localhost:8000/api/optumadmin"
licenseapi.key = "your-secret-api-key-change-this-in-production"
```

**New helper functions:**
- `reportVMUsageToLicenseAPI(accountId, creditsUsed, vmId, vmName, machineType, runtimeMinutes, zone)` - Reports usage to the Laravel API
- `checkCreditsForVM(accountId, minimumCredits)` - Checks credit balance before VM start

**`stopVM` changes:**
- After updating Firestore (legacy), now also calls `reportVMUsageToLicenseAPI()` to sync usage to MySQL

**`createVM` changes:**
- Before creating a VM, calls `checkCreditsForVM()` to verify sufficient credits
- Returns 403 with "Insufficient credits" if balance too low

---

## Data Flow

```
VM Create Request
  → checkCreditsForVM(accountId) → GET /api/optumadmin/vm/check-credits/{id}
  → If insufficient: 403 error
  → If OK: Proceed with GCP VM creation

VM Stop/Delete
  → Calculate credits: machinetype.creditsminute * runtime
  → Update Firestore customers (legacy)
  → reportVMUsageToLicenseAPI() → POST /api/optumadmin/vm/usage
    → account_credits.credits_used += amount
    → credit_usage_logs INSERT (resource_type='vm')
```

---

## Database Tables Used

- `account_credits` - Balance tracking (credits, credits_used per account)
- `credit_usage_logs` - Per-VM usage records (was previously empty, now populated on VM stop)
- `credit_transactions` - Stripe payment records (unchanged)

---

## Deployment

- Firebase Cloud Functions deployed to `optum-80593` project
- All 28 functions updated successfully
- `getVMs` function deleted (was orphaned)
- Firebase config set for `licenseapi.url` and `licenseapi.key`

---

## TODO / Known Issues

- `licenseapi.url` is set to `localhost:8000` - needs production URL when backend is deployed
- `functions.config()` deprecated by Firebase (March 2026 deadline) - migrate to env params
- Customer-to-account mapping: Cloud Functions use `customerData.account_id || customerId` - Firestore customer records need an `account_id` field mapping to MySQL `account.id`
- Node engine warning: package.json requires Node 20, running Node 22
