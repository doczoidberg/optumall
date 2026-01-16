# CLAUDE.md - Optum Multi-Project Management

This file provides guidance to Claude Code when working across both projects in this workspace.

## Workspace Structure

```
C:\optum\
├── optumadmin\          # Angular app for managing VMs and cloud simulation computations
└── sourcetooptumce\     # Laravel Lumen license management with account/identity system
```

Each project has its own CLAUDE.md for project-specific guidance:
- [optumadmin/optumadmin/CLAUDE.md](optumadmin/optumadmin/CLAUDE.md)
- sourcetooptumce (needs CLAUDE.md creation)

## IMPORTANT: PHP Development Server

### Starting the Backend Server

**ALWAYS use background mode when starting PHP server:**

```bash
cd C:\optum\sourcetooptumce\backend\licensemanagement
php -S localhost:8000 -t public 2>&1
# Run this in background mode using run_in_background: true in Bash tool
```

**Server will output:**
```
[Thu Jan 15 17:54:20 2026] PHP 7.4.33 Development Server (http://localhost:8000) started
```

### Common Mistakes to Avoid

1. **DON'T run `php artisan migrate` without checking if data exists first**
   - ALWAYS check table counts before migrations
   - Migrations will DROP and recreate tables, LOSING ALL DATA
   - Use the import script instead: `php database/migrations/import_all.php`

2. **DON'T use `mysql` command on Windows**
   - XAMPP MySQL client has authentication plugin issues
   - ALWAYS use PHP PDO for database operations

3. **DON'T forget the database has 27 tables**
   - If you see only 8 tables, something went wrong
   - Run import_all.php to restore all data

4. **Login API requires `user_name` NOT `email`**
   - Endpoint: `POST /api/auth/login`
   - Body: `{"user_name": "email@example.com", "password": "password"}`
   - DON'T use `"email"` field in login request

### Database Information

**Database:** `license_local` (MySQL/MariaDB)
**Total Tables:** 27
**Total Records:** ~308,632 rows

**Critical Tables:**
- `identity` - 22,173 users (NOT in initial migrations, needs manual import)
- `account` - 22,950 accounts
- `license` - 26,758 licenses
- `session_stat` - 49,334 sessions
- `invitation`, `tokens`, `notification` - Missing from migrations, exist in SQL backup

**Import Script Location:**
`C:\optum\sourcetooptumce\backend\licensemanagement\database\migrations\import_all.php`

**To restore full database:**
```bash
cd C:\optum\sourcetooptumce\backend\licensemanagement\database\migrations
php import_all.php
```

### Admin Account for Testing

**SuperAdmin Account:**
- Username: `daniel.zuidinga@googlemail.com`
- Password: `test123`
- Role: 2 (SuperAdmin)
- Identity ID: 23871
- Account ID: 55248

**Role Levels:**
- 0 = Normal User
- 1 = Admin (organization admin via account_member.member_role)
- 2 = SuperAdmin (global admin, sees all data)

**Important:** The `getRoleAttribute()` in User model checks both `identity.role` AND `account_member.member_role`. SuperAdmin (role=2) is determined by `identity.role` field only.

### Database Schema & Migrations

**Migration Files Created (2025-01-15):**
1. `2025_01_15_000001_create_invitation_table.php` - User invitations
2. `2025_01_15_000002_create_tokens_table.php` - Verification tokens
3. `2025_01_15_000003_create_session_stat_table.php` - Session statistics
4. `2025_01_15_000004_create_otk_table.php` - One-time keys
5. `2025_01_15_000005_create_notification_table.php` - User notifications

**Existing Migrations:**
- `2020_01_01_000000_create_app_tables.php` - Main tables (account, license, identity, etc.)
- `2020_08_06_171944_create_passwords_resets_table.php` - Password resets
- `2024_11_17_000000_add_missing_identity_columns.php` - Identity fields (email_validated, two_factor_enabled, etc.)
- `2025_01_10_000000_create_credits_tables.php` - Credit system (account_credits, credit_transactions, credit_usage_logs)

**Key Schema Fixes Applied:**
1. **account table** - Changed `name` field from VARCHAR(2500) to VARCHAR(500) to fix index length error
2. **account table** - Added `origin` and `_last_seen` fields
3. **license table** - Added missing fields: `link_id`, `auto_renewal`, `arbitrary_domain`, `automatic_assign`, `notif`, `notif_emails`, `notif_text`, `notif_option`, `notif_sent`, `_lease_until`, `sys_data`, `logs`
4. **identity table** - Removed problematic foreign key constraint `identity_ibfk_2` that referenced `account.name`

**Documentation vs Actual Database:**
- SVG docs in `C:\optum\SourceToOptumCE\docs\` are NOW ACCURATE after schema fixes
- `database-erd.svg` matches actual database structure
- `organization-structure.svg` explains the account/identity/member relationships

### API Endpoints Reference

**Authentication:**
- `POST /api/auth/login` - Login (requires `user_name` and `password`)
- `POST /api/auth/register` - Register new user
- `POST /password/email` - Request password reset
- `POST /password/reset` - Reset password with token

**OptumAdmin Integration (API Key Protected):**
- `GET /api/optumadmin/accounts` - Get all accounts
- `GET /api/optumadmin/accounts/{id}` - Get specific account
- `GET /api/optumadmin/users` - Get all users
- `GET /api/optumadmin/credits/balance/{accountId}` - Get credit balance
- `GET /api/optumadmin/credits/transactions/{accountId}` - Get credit transactions

**Firebase User Sync API (API Key Protected):**
- `GET /api/firebase/health` - Check Firebase connection health
- `GET /api/firebase/status` - Get sync status and statistics
- `POST /api/firebase/users/{id}` - Sync single user to Firebase
- `POST /api/firebase/users/batch` - Sync multiple users (body: `{"user_ids": [1,2,3]}`)
- `POST /api/firebase/users/full-sync` - Full sync with pagination (query: `?limit=100&offset=0`)
- `POST /api/firebase/users/by-account/{accountId}` - Sync all users of an account/organization
- `DELETE /api/firebase/users/{id}` - Delete user from Firebase

**API Key:** Set in `.env` as `OPTUMADMIN_API_KEY`

**Firebase Configuration:** Set in `.env`:
- `FIREBASE_FUNCTIONS_URL` - Firebase Cloud Functions base URL
- `FIREBASE_API_KEY` - API key for Firebase authentication

## Projects Overview

### 1. OptumAdmin (VM Management)
**Location:** `optumadmin/optumadmin/`
**Tech Stack:** Angular 18 + Firebase (Firestore + Cloud Functions) + Google Cloud Compute API
**Purpose:** Admin dashboard for managing Google Cloud VMs for simulation computations

**Key Features:**
- VM provisioning and lifecycle management (create, start, stop)
- Customer management with credit/token system
- Payment integration via Stripe
- Usage tracking and billing
- Real-time VM monitoring

**Current Authentication:**
- Firebase Authentication (email/password)
- Custom `adminUsers` collection with role-based access (admin/viewer)
- Route guards: `AuthGuard`, `AdminGuard`

**Current Customer System (TO BE REPLACED):**
- Firestore `customers` collection
- Fields: name, license, credits, tokens, creditsused
- Direct linkage to VMs via `customerid` field
- Payment/transaction tracking per customer

### 2. SourceToOptumCE (License Management)
**Location:** `sourcetooptumce/backend/licensemanagement/`
**Tech Stack:** Laravel Lumen (PHP) + MySQL + Vue.js frontend
**Purpose:** License management system with sophisticated account/identity infrastructure

**Key Features:**
- Multi-tenant account/organization system
- JWT-based authentication
- Role-based access control (global + organization roles)
- User groups within organizations
- Invitation system for onboarding
- Email verification and 2FA support
- License assignment and tracking

**Account/Identity System Architecture:**
- **identity** table: Individual users with credentials
- **account** table: Organizations (can be individual or company)
- **account_member** table: User-to-organization mappings with roles
- **account_group** table: Groups within organizations
- **invitation** table: Invitation codes for user onboarding

## Migration Strategy: Customer System → Account/Identity System

### Goal
Replace the Firebase-based `customers` collection in optumadmin with the sophisticated account/identity system from sourcetooptumce to enable:
- Unified user management across both applications
- Organization-based multi-tenancy
- Hierarchical permissions (global admin, org admin, org member)
- Better scalability and access control

### Phase 1: Preparation & Analysis

**1.1 Map Customer Data to Account Schema**
- Current: `customers` → Target: `account` table
  - `customers.name` → `account.name`
  - `customers.license` → Link to license management system
  - `customers.credits/tokens` → New credits tracking table/field
  - `customers.creditsused` → Usage tracking table

**1.2 Identify Integration Points**
Key files in optumadmin that need modification:
- `src/app/customers/customers.component.ts` (list view)
- `src/app/customer/customer.component.ts` (detail view)
- `src/app/services/admin-users.service.ts` (auth service)
- `src/app/guards/auth.guard.ts` and `admin.guard.ts`
- `functions/index.js` (Cloud Functions - VM operations, payment, credit checks)

**1.3 Database Migration Plan**
```sql
-- New tables needed in MySQL (or keep Firestore with new schema)
CREATE TABLE vm_credits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  account_id INT NOT NULL,
  credits DECIMAL(10,2) DEFAULT 0,
  credits_used DECIMAL(10,2) DEFAULT 0,
  last_credit_purchase TIMESTAMP,
  last_token_purchase TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES account(id)
);

CREATE TABLE vm_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  account_id INT NOT NULL,
  package_id VARCHAR(50),
  tokens INT,
  amount DECIMAL(10,2),
  status VARCHAR(50),
  stripe_session_id VARCHAR(255),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES account(id)
);

CREATE TABLE vm_machines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  account_id INT NOT NULL,
  gcp_machine_id VARCHAR(255),
  machine_name VARCHAR(255),
  machine_type VARCHAR(100),
  zone VARCHAR(100),
  state VARCHAR(50),
  credits_used DECIMAL(10,2) DEFAULT 0,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES account(id)
);
```

### Phase 2: Backend Integration

**2.1 Create API Bridge Service**
- Create new service in sourcetooptumce: `VMAccountController.php`
- Expose endpoints for optumadmin:
  - `GET /api/vm/account/{id}/credits` - Get account credits
  - `POST /api/vm/account/{id}/credits` - Update credits
  - `GET /api/vm/account/{id}/machines` - List VMs for account
  - `POST /api/vm/account/{id}/transactions` - Record transaction

**2.2 Modify OptumAdmin Cloud Functions**
Update `functions/index.js`:
```javascript
// Replace Firestore customer lookups with API calls to sourcetooptumce
async function getAccountCredits(accountId) {
  const response = await fetch(
    `${LICENSEMANAGEMENT_API}/api/vm/account/${accountId}/credits`,
    {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    }
  );
  return response.json();
}

// Update createVM, startVM, stopVM to use accountId instead of customerId
// Update payment success webhook to call sourcetooptumce API
```

**2.3 Authentication Migration**
- Replace Firebase Auth with JWT from sourcetooptumce
- Update Angular HttpClient interceptor to add JWT token
- Modify guards to validate JWT instead of Firebase authState

### Phase 3: Frontend Integration

**3.1 Replace Customer Components**
- Rename `customers` → `accounts` component
- Update to call sourcetooptumce API endpoints
- Display organization structure (accounts + members)
- Show group memberships

**3.2 Update Authentication Flow**
```typescript
// New AuthService in optumadmin
login(email: string, password: string) {
  return this.http.post<{token: string, user: any}>(
    `${LICENSEMANAGEMENT_API}/api/auth/login`,
    { email, password }
  ).pipe(
    tap(response => {
      localStorage.setItem('jwt_token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
    })
  );
}
```

**3.3 Add Organization Selector**
- If user is member of multiple organizations
- Dropdown to switch active organization context
- Store selected `account_id` in session

### Phase 4: Data Migration

**4.1 Export Existing Customer Data**
```javascript
// Cloud Function to export customers to JSON
exports.exportCustomers = functions.https.onRequest(async (req, res) => {
  const snapshot = await admin.firestore().collection('customers').get();
  const customers = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  res.json(customers);
});
```

**4.2 Import into Account System**
```php
// Laravel command to import customers as accounts
php artisan migrate:customers-to-accounts customers.json
```

**4.3 Map Customer IDs to Account IDs**
Create mapping table during transition:
```sql
CREATE TABLE customer_account_mapping (
  old_customer_id VARCHAR(255) PRIMARY KEY,
  new_account_id INT NOT NULL,
  migrated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (new_account_id) REFERENCES account(id)
);
```

### Phase 5: Testing & Rollout

**5.1 Parallel Run**
- Keep both systems running temporarily
- Write to both systems during transition
- Validate data consistency

**5.2 Feature Flags**
```typescript
// environment.ts
export const environment = {
  useNewAccountSystem: true, // Toggle for gradual rollout
  licenseManagementApiUrl: 'http://localhost:8000'
};
```

**5.3 Rollback Plan**
- Keep Firestore `customers` collection read-only
- Maintain ability to switch back via feature flag

### Phase 6: Cleanup

**6.1 Remove Legacy Code**
- Delete `customers.component.ts` (old component)
- Remove `customers` collection queries
- Delete unused Firebase Authentication code
- Remove old payment webhooks

**6.2 Update Documentation**
- Update CLAUDE.md files in both projects
- Document new API endpoints
- Create architecture diagrams

## Development Workflow Across Projects

### Starting Both Projects for Development

**Terminal 1 - OptumAdmin Frontend:**
```bash
cd C:\optum\optumadmin\optumadmin
npm start
# Runs on http://localhost:4200
```

**Terminal 2 - OptumAdmin Backend (Firebase Functions):**
```bash
cd C:\optum\optumadmin\optumadmin\functions
npm run serve
# Functions emulator runs on http://localhost:5001
```

**Terminal 3 - SourceToOptumCE Backend:**
```bash
cd C:\optum\sourcetooptumce\backend\licensemanagement
php -S localhost:8000 -t public
# API runs on http://localhost:8000
```

**Terminal 4 - SourceToOptumCE Frontend (if needed):**
```bash
cd C:\optum\sourcetooptumce\frontend
npm run serve
# Vue app runs on http://localhost:8080
```

### Cross-Project Dependencies

**OptumAdmin depends on SourceToOptumCE for:**
- User authentication (JWT tokens)
- Account/organization data
- User role/permission information
- License validation

**SourceToOptumCE may depend on OptumAdmin for:**
- VM usage data for billing
- Credit consumption tracking
- Integration with GCP resources

## API Integration Endpoints

### SourceToOptumCE → OptumAdmin

**Base URL:** `https://us-central1-optum-80593.cloudfunctions.net`

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| `POST /api/vm/sync-usage` | Sync VM usage to billing | JWT (Admin) |
| `GET /api/vm/account/{id}/machines` | Get VMs for account | JWT |
| `GET /api/vm/health` | Check OptumAdmin availability | None |

### OptumAdmin → SourceToOptumCE

**Base URL:** `http://localhost:8000` (dev) or production URL

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| `POST /api/auth/login` | User authentication | None |
| `GET /api/profile` | Get current user info | JWT |
| `GET /api/vm/account/{id}/credits` | Get account credits | JWT |
| `POST /api/vm/account/{id}/credits/deduct` | Deduct VM usage | JWT |
| `POST /api/vm/account/{id}/transactions` | Record payment | JWT |

## Environment Variables & Configuration

### OptumAdmin (.env in functions/)
```env
LICENSEMANAGEMENT_API_URL=http://localhost:8000
LICENSEMANAGEMENT_API_KEY=your-api-key-here
GCP_PROJECT_ID=optum-80593
GCP_ZONE=us-central1-a
STRIPE_SECRET_KEY=sk_test_...
```

### SourceToOptumCE (.env in backend/licensemanagement/)
```env
OPTUMADMIN_WEBHOOK_URL=https://us-central1-optum-80593.cloudfunctions.net/vmUsageWebhook
OPTUMADMIN_API_KEY=your-api-key-here
JWT_SECRET=your-jwt-secret
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=licensemanagement
DB_USERNAME=root
DB_PASSWORD=
```

## Common Tasks

### Task: Add New User with VM Access

1. **In SourceToOptumCE:** Create user account
   ```bash
   POST /api/auth/register
   {
     "email": "user@example.com",
     "password": "secure123",
     "first_name": "John",
     "last_name": "Doe",
     "account_name": "Acme Corp"
   }
   ```

2. **Verify email:** User clicks activation link

3. **Assign credits in SourceToOptumCE:**
   ```php
   // In VMAccountController
   public function addCredits($accountId, $amount) {
     VMCredit::where('account_id', $accountId)
       ->increment('credits', $amount);
   }
   ```

4. **User logs into OptumAdmin:** JWT token validated, credits displayed

5. **User creates VM:** Credit check via API, VM provisioned, usage tracked

### Task: Check User Permissions Before VM Operation

```typescript
// In optumadmin service
async canCreateVM(accountId: number): Promise<boolean> {
  const user = this.authService.currentUser;

  // Check if user is admin or member of the account
  const response = await this.http.get<{role: string}>(
    `${env.licenseManagementApiUrl}/api/account/${accountId}/member/${user.accountId}`
  ).toPromise();

  return response.role === 'admin' || response.role === 'member';
}
```

### Task: Sync VM Usage to Billing

```javascript
// Cloud Function triggered hourly
exports.syncVMUsage = functions.pubsub.schedule('every 1 hours').onRun(async () => {
  const machines = await admin.firestore().collection('machines')
    .where('state', '==', 'RUNNING').get();

  for (const machineDoc of machines.docs) {
    const machine = machineDoc.data();
    const creditsUsed = calculateCredits(machine);

    // Call sourcetooptumce API to deduct credits
    await fetch(`${LICENSEMANAGEMENT_API}/api/vm/account/${machine.accountId}/credits/deduct`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_JWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: creditsUsed,
        machineId: machine.id,
        timestamp: new Date()
      })
    });
  }
});
```

## Important Notes

### Security Considerations

1. **API Keys:** Never commit API keys to git. Use environment variables.
2. **JWT Validation:** Always validate JWT tokens on backend before DB operations.
3. **CORS:** Configure CORS carefully to allow only trusted origins.
4. **Rate Limiting:** Implement rate limiting on API endpoints.
5. **SQL Injection:** Use parameterized queries in all database operations.

### Data Consistency

- **Distributed Transactions:** Be aware that Firestore and MySQL are separate. No atomic transactions across both.
- **Eventual Consistency:** Accept that there may be brief delays in data synchronization.
- **Idempotency:** Make API endpoints idempotent to handle retries safely.

### Performance Optimization

- **Caching:** Cache account/user data in optumadmin to reduce API calls.
- **Connection Pooling:** Reuse HTTP connections between services.
- **Batch Operations:** Batch API calls when possible (e.g., bulk credit updates).

### Monitoring & Logging

- **Centralized Logging:** Send logs from both systems to same location (Cloud Logging).
- **Error Tracking:** Use Sentry or similar for error monitoring.
- **API Metrics:** Track API call success rates, latencies, error rates.

## Migration Checklist

- [ ] **Preparation**
  - [ ] Document current customer data structure
  - [ ] Map customer fields to account schema
  - [ ] Identify all customer references in optumadmin codebase
  - [ ] Create data migration scripts

- [ ] **Backend Setup**
  - [ ] Create VM-specific tables in sourcetooptumce database
  - [ ] Implement VM account endpoints in sourcetooptumce
  - [ ] Update Cloud Functions to call sourcetooptumce API
  - [ ] Create service account JWT for server-to-server auth
  - [ ] Write integration tests for API calls

- [ ] **Frontend Updates**
  - [ ] Replace Firebase Auth with JWT auth service
  - [ ] Update HTTP interceptor for JWT tokens
  - [ ] Modify customer components to use new API
  - [ ] Add organization selector if needed
  - [ ] Update guards for JWT validation

- [ ] **Data Migration**
  - [ ] Export customers from Firestore
  - [ ] Import into account system
  - [ ] Create customer-to-account mapping table
  - [ ] Migrate transactions history
  - [ ] Migrate machine records

- [ ] **Testing**
  - [ ] Test authentication flow end-to-end
  - [ ] Test VM creation with credit checks
  - [ ] Test payment flow with new system
  - [ ] Test multi-organization scenarios
  - [ ] Test permission boundaries (admin vs member)
  - [ ] Load test API endpoints

- [ ] **Deployment**
  - [ ] Deploy sourcetooptumce changes
  - [ ] Deploy optumadmin backend (Cloud Functions)
  - [ ] Deploy optumadmin frontend
  - [ ] Monitor error rates
  - [ ] Verify data consistency

- [ ] **Cleanup**
  - [ ] Remove old customer components
  - [ ] Delete Firebase customer queries
  - [ ] Archive old data
  - [ ] Update documentation

## Troubleshooting

### Issue: JWT token expired
**Solution:** Implement token refresh mechanism:
```typescript
if (error.status === 401) {
  // Token expired, redirect to login
  this.router.navigate(['/login']);
}
```

### Issue: Credits not updating after VM usage
**Solution:** Check Cloud Function logs:
```bash
cd functions && npm run logs
# Look for API call errors
```

### Issue: User can't see VMs after migration
**Solution:** Verify account mapping:
```sql
SELECT * FROM customer_account_mapping WHERE old_customer_id = 'abc123';
```

### Issue: CORS errors when calling API
**Solution:** Add origin to CORS config in sourcetooptumce:
```php
// In bootstrap/app.php
$app->middleware([
    'cors' => \App\Http\Middleware\CorsMiddleware::class,
]);
```

## Future Enhancements

1. **Single Sign-On (SSO):** Implement OAuth2/SAML for enterprise customers
2. **Usage Analytics Dashboard:** Visualize VM usage across organizations
3. **Cost Optimization:** Auto-stop idle VMs, recommend cheaper machine types
4. **Multi-Region Support:** Deploy VMs in regions closest to users
5. **Audit Logs:** Track all user actions for compliance
6. **API Rate Limiting:** Implement per-account API quotas
7. **Webhook Notifications:** Real-time updates for VM state changes
8. **Mobile App:** React Native app for monitoring VMs on mobile

## Resources

- [OptumAdmin CLAUDE.md](optumadmin/optumadmin/CLAUDE.md)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Laravel Lumen Documentation](https://lumen.laravel.com/docs)
- [JWT Authentication Best Practices](https://tools.ietf.org/html/rfc7519)
- [Google Cloud Compute API Reference](https://cloud.google.com/compute/docs/reference/rest/v1)
