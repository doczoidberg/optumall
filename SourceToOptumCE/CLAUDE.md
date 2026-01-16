# CLAUDE.md - SourceToOptumCE License Management

This file provides guidance for working with the SourceToOptumCE license management system.

## Project Overview

**Location:** `C:\optum\sourcetooptumce\`
**Tech Stack:**
- Backend: Laravel Lumen (PHP 7.4.33) + MySQL/MariaDB
- Frontend: Vue.js 2 + Bootstrap-Vue + Webpack

**Purpose:** License management system with sophisticated account/identity infrastructure for multi-tenant organizations.

## Quick Start: Running the Development Servers

### Start Backend (PHP/Lumen API)

```bash
cd /c/optum/sourcetooptumce/backend/licensemanagement
php -S localhost:8000 -t public 2>&1
# IMPORTANT: Run in background mode (run_in_background: true)
```

**Expected Output:**
```
[Fri Jan 16 07:54:19 2026] PHP 7.4.33 Development Server (http://localhost:8000) started
```

### Start Frontend (Vue.js)

```bash
cd /c/optum/sourcetooptumce/frontend
npm run dev
# IMPORTANT: Run in background mode (run_in_background: true)
```

**Expected Output:**
```
DONE  Compiled successfully in ~50s
Your application is running here: http://localhost:8080
```

### Access the Application

- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:8000

## Admin Accounts for Testing

### SuperAdmin Accounts (role=2) - Full System Access

**Primary Test Account:**
- Email: `info@seoaachen.de`
- Password: `test123`
- Identity ID: 23761
- Role: 2 (SuperAdmin)

**Other SuperAdmin Accounts:**
- Email: `liuchenglong@kulunsoft.com` (ID: 109)
- Email: `zhangjun@kulunsoft.com` (ID: 110)

### Admin Accounts (role=1) - Organization Admin

- `mah@optumce.com` (ID: 29) - Morten Herfelt
- `jkr@optumce.com` (ID: 30) - Jorgen Krabbenhoft
- `smh@optumce.com` (ID: 40) - Sandra Myrtue
- `kk@optumce.com` (ID: 145) - Kristian Krabbenhoft
- `dth@optumce.com` (ID: 272) - Hung Dang

### Normal User Account (role=0) - Testing User Permissions

- Email: `daniel.zuidinga@googlemail.com`
- Password: `test123`
- Identity ID: 23871
- Role: 0 (Normal User)

### Role Hierarchy

| Role | Level | Description | Count |
|------|-------|-------------|-------|
| 0 | Normal User | Standard user with limited permissions | 22,160 |
| 1 | Admin | Organization admin (via account_member.member_role) | 10 |
| 2 | SuperAdmin | Global admin with access to all data | 3 |

**Note:** The `getRoleAttribute()` in User model checks both `identity.role` AND `account_member.member_role`. SuperAdmin (role=2) is determined by `identity.role` field only.

## Database Information

**Database:** `license_local` (MySQL/MariaDB)
**Total Tables:** 27
**Total Records:** ~308,632 rows

### Critical Tables

- `identity` - 22,173 users (individual user accounts with credentials)
- `account` - 22,950 accounts (organizations/companies)
- `account_member` - User-to-organization mappings with roles
- `account_group` - Groups within organizations
- `license` - 26,758 licenses
- `session_stat` - 49,334 session records
- `invitation` - User invitation codes
- `tokens` - Verification tokens for email/2FA
- `notification` - User notifications

### Database Restore

**If database is empty or missing tables, restore using:**

```bash
cd /c/optum/sourcetooptumce/backend/licensemanagement/database/migrations
php import_all.php
```

**NEVER run `php artisan migrate` without checking table counts first!** Migrations will DROP and recreate tables, losing all data.

## API Authentication

### Login Endpoint

**Endpoint:** `POST /api/auth/login`

**Important:** Use `user_name` field, NOT `email`!

```json
{
  "user_name": "info@seoaachen.de",
  "password": "test123"
}
```

**Response:**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 23761,
    "email": "info@seoaachen.de",
    "role": 2,
    ...
  }
}
```

### Other Auth Endpoints

- `POST /api/auth/register` - Register new user
- `POST /password/email` - Request password reset
- `POST /password/reset` - Reset password with token

## Architecture: Account/Identity System

### Multi-Tenant Organization Structure

```
Account (Organization)
├── Account Members (Users in this organization)
│   ├── Member Role (0=member, 1=admin)
│   └── Links to Identity records
├── Account Groups (Teams/Departments)
│   └── Group Members
└── Licenses assigned to Account
```

### Key Relationships

1. **Identity** = Individual person with login credentials
2. **Account** = Organization/Company (can be individual or multi-user)
3. **Account_Member** = Junction table linking Identity to Account with role
4. **Account_Group** = Sub-groups within an Account

**Important:** A single Identity can be a member of multiple Accounts with different roles in each.

## Common Development Tasks

### Check User's Role

```bash
cd /c/optum/sourcetooptumce/backend/licensemanagement
php -r "
\$pdo = new PDO('mysql:host=127.0.0.1;dbname=license_local', 'root', '');
\$stmt = \$pdo->prepare('SELECT id, email, first_name, last_name, role FROM identity WHERE email = ?');
\$stmt->execute(['user@example.com']);
print_r(\$stmt->fetch(PDO::FETCH_ASSOC));
"
```

### List All SuperAdmins

```bash
cd /c/optum/sourcetooptumce/backend/licensemanagement
php -r "
\$pdo = new PDO('mysql:host=127.0.0.1;dbname=license_local', 'root', '');
\$stmt = \$pdo->query('SELECT email, first_name, last_name FROM identity WHERE role = 2');
while (\$row = \$stmt->fetch(PDO::FETCH_ASSOC)) {
    echo \$row['email'] . ' - ' . \$row['first_name'] . ' ' . \$row['last_name'] . PHP_EOL;
}
"
```

### Database Operations - USE PDO, NOT mysql command

**DON'T use `mysql` command on Windows** - XAMPP MySQL client has authentication plugin issues.

**ALWAYS use PHP PDO for database operations:**

```php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=license_local', 'root', '');
// Run your queries
```

## Migration Files

### Created Migrations (2025-01-15)

1. `2025_01_15_000001_create_invitation_table.php`
2. `2025_01_15_000002_create_tokens_table.php`
3. `2025_01_15_000003_create_session_stat_table.php`
4. `2025_01_15_000004_create_otk_table.php`
5. `2025_01_15_000005_create_notification_table.php`

### Existing Migrations

- `2020_01_01_000000_create_app_tables.php` - Main tables
- `2020_08_06_171944_create_passwords_resets_table.php`
- `2024_11_17_000000_add_missing_identity_columns.php`
- `2025_01_10_000000_create_credits_tables.php` - Credit system

## Integration with OptumAdmin

This license management system is being integrated with the OptumAdmin VM management application to replace Firebase-based customer management.

**API Key Protected Endpoints** (for OptumAdmin):

- `GET /api/optumadmin/accounts` - Get all accounts
- `GET /api/optumadmin/accounts/{id}` - Get specific account
- `GET /api/optumadmin/users` - Get all users
- `GET /api/optumadmin/credits/balance/{accountId}` - Get credit balance
- `GET /api/optumadmin/credits/transactions/{accountId}` - Get transactions

**API Key:** Set in `.env` as `OPTUMADMIN_API_KEY`

## Important Path Notes

**When using Bash commands on Windows:**
- Use forward slashes: `/c/optum/sourcetooptumce/...`
- DON'T use backslashes: `C:\optum\sourcetooptumce\...` (will fail)
- DON'T use `cd` without path conversion

**When referencing files in documentation:**
- Use Windows paths: `C:\optum\sourcetooptumce\...`

## Troubleshooting

### Server won't start

**Problem:** Path not found error
**Solution:** Use `/c/optum/...` format, not `C:\optum\...`

### Database tables missing

**Problem:** Only 8 tables instead of 27
**Solution:** Run `php database/migrations/import_all.php`

### Login returns 401 Unauthorized

**Problem:** Using wrong field name
**Solution:** Use `user_name` field, not `email` in login request

### Can't access admin features

**Problem:** Logged in as Normal User (role=0)
**Solution:** Use `info@seoaachen.de` for SuperAdmin access (role=2)

## Documentation

**ERD Diagrams:** `C:\optum\SourceToOptumCE\docs\`
- `database-erd.svg` - Database schema
- `organization-structure.svg` - Account/Identity relationships

## Environment Configuration

**Backend `.env` location:** `C:\optum\sourcetooptumce\backend\licensemanagement\.env`

**Key settings:**
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=license_local
DB_USERNAME=root
DB_PASSWORD=

JWT_SECRET=your-jwt-secret
OPTUMADMIN_API_KEY=your-api-key
```

## Testing Workflow

1. Start both servers (PHP backend + Vue frontend)
2. Open http://localhost:8080
3. Login with SuperAdmin: `info@seoaachen.de` / `test123`
4. Test admin features (user management, license assignment, etc.)
5. Logout and test with Normal User: `daniel.zuidinga@googlemail.com` / `test123`
6. Verify role-based access controls work correctly
