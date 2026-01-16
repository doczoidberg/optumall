# Account & Organization Structure

This document explains the relationship between accounts, organizations, identities (users), and members in the SourceToOptumCE license management system.

## Overview

In this system, **"account"** and **"organization"** refer to the same database entity (`account` table) but are used in different contexts:

- **Account** = The database entity that holds tokens, licenses, and other resources
- **Organization** = An account with multiple members (users)
- **Identity** = Individual user credentials (login information)
- **Member** = A user linked to an organization/account

## Database Structure

### 1. The `account` Table

Represents both individual accounts AND organizations:

```sql
account
├── id                  -- Unique account identifier
├── name                -- Account name (e.g., "Acme Corp" or "john.doe@email.com")
├── type                -- 0=individual, 1=organization
├── domain              -- Organization domain (optional)
├── created_at
└── updated_at
```

**Key Point:** Every user has at least ONE account (their personal account).

### 2. The `identity` Table

Represents individual users with login credentials:

```sql
identity
├── id                  -- Unique user identifier
├── user_name           -- Username (usually email)
├── email               -- User's email address
├── password            -- Hashed password
├── first_name
├── last_name
├── account_id          -- Links to their PRIMARY/personal account
├── role                -- 0=user, 1=admin, 2=superadmin (global role)
├── email_validated     -- Email verification status
├── two_factor_enabled  -- 2FA status
├── created_at
└── updated_at
```

**Key Point:** `account_id` points to the user's personal account, NOT necessarily the organization they work for.

### 3. The `account_member` Table

Links users to organizations (many-to-many relationship):

```sql
account_member
├── id                  -- Unique membership identifier
├── account_id          -- The organization account ID
├── member_id           -- The user's personal account_id (NOT identity.id!)
├── member_role         -- 0=member, 1=admin (organization-level role)
├── status              -- Membership status
├── created_at
└── updated_at
```

**Key Point:** This table allows users to be members of multiple organizations.

### 4. The `account_credits` Table

Stores token/credit balances at the ACCOUNT level:

```sql
account_credits
├── id
├── account_id          -- The account that owns these credits
├── credits             -- Total credits purchased
├── credits_used        -- Credits already consumed
├── last_purchase_date
├── created_date
└── updated_date
```

**Key Point:** Tokens are ALWAYS assigned to accounts, never to individual users.

## How It Works: Examples

### Example 1: Individual User (Simple Case)

**User:** daniel.zuidinga@googlemail.com

```
┌─────────────────────────────────────────┐
│ identity (user table)                   │
├─────────────────────────────────────────┤
│ id: 23871                               │
│ user_name: daniel.zuidinga@googlemail.com│
│ email: daniel.zuidinga@googlemail.com   │
│ account_id: 23871 ──────────┐           │
│ role: 0 (normal user)       │           │
└─────────────────────────────┼───────────┘
                              │
                              ▼
              ┌───────────────────────────┐
              │ account                   │
              ├───────────────────────────┤
              │ id: 23871                 │
              │ name: daniel.zuidinga@... │
              │ type: 0 (individual)      │
              └───────────┬───────────────┘
                          │
                          ▼
          ┌───────────────────────────────┐
          │ account_credits               │
          ├───────────────────────────────┤
          │ account_id: 23871             │
          │ credits: 1000                 │
          │ credits_used: 200             │
          │ available: 800                │
          └───────────────────────────────┘
```

**Result:** You have your own personal account with 1000 tokens. Only you can use them.

### Example 2: Organization with Multiple Members

**Organization:** Acme Corporation (Account ID: 42)

```
Organization Account:
┌───────────────────────────┐
│ account                   │
├───────────────────────────┤
│ id: 42                    │
│ name: "Acme Corp"         │
│ type: 1 (organization)    │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│ account_credits           │
├───────────────────────────┤
│ account_id: 42            │
│ credits: 5000             │ ← Shared by all members
│ credits_used: 1200        │
│ available: 3800           │
└───────────────────────────┘

Members:
┌──────────────────────────────────────────────────────────┐
│ account_member                                           │
├──────────────────────────────────────────────────────────┤
│ account_id: 42, member_id: 100, member_role: 1 (admin)  │ ← John (admin)
│ account_id: 42, member_id: 101, member_role: 0 (member) │ ← Jane (member)
│ account_id: 42, member_id: 102, member_role: 0 (member) │ ← Bob (member)
└──────────────────────────────────────────────────────────┘
            │               │               │
            ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ identity    │ │ identity    │ │ identity    │
    │ id: 100     │ │ id: 101     │ │ id: 102     │
    │ John Smith  │ │ Jane Doe    │ │ Bob Wilson  │
    │ account_id: │ │ account_id: │ │ account_id: │
    │ 100 (own)   │ │ 101 (own)   │ │ 102 (own)   │
    └─────────────┘ └─────────────┘ └─────────────┘
```

**Result:** All three members (John, Jane, Bob) share the same pool of 5000 tokens.

### Example 3: User in Multiple Organizations

**User:** Sarah (Account ID: 200)

```
Sarah's Personal Account:
┌───────────────────────────┐
│ identity                  │
├───────────────────────────┤
│ id: 200                   │
│ user_name: sarah@email.com│
│ account_id: 200           │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│ account                   │
├───────────────────────────┤
│ id: 200                   │
│ name: sarah@email.com     │
│ credits: 500 (personal)   │ ← Sarah's personal tokens
└───────────────────────────┘

Sarah's Memberships:
┌──────────────────────────────────────────────────────┐
│ account_member                                       │
├──────────────────────────────────────────────────────┤
│ account_id: 42, member_id: 200, member_role: 0      │ ← Member of Acme Corp
│ account_id: 99, member_id: 200, member_role: 1      │ ← Admin of TechStart Inc
└──────────────────────────────────────────────────────┘
            │                           │
            ▼                           ▼
┌───────────────────────┐   ┌───────────────────────┐
│ account (id: 42)      │   │ account (id: 99)      │
│ Acme Corp             │   │ TechStart Inc         │
│ credits: 5000         │   │ credits: 10000        │
└───────────────────────┘   └───────────────────────┘
```

**Result:** Sarah can access:
- Her personal 500 tokens (account 200)
- Acme Corp's 5000 tokens (account 42) - as a member
- TechStart Inc's 10000 tokens (account 99) - as an admin

## Role System

There are TWO types of roles in the system:

### 1. Global Role (`identity.role`)

Stored in the `identity` table:

| Value | Role | Description |
|-------|------|-------------|
| 0 | User | Normal user with basic permissions |
| 1 | Admin | Organization admin (can manage users in their org) |
| 2 | SuperAdmin | Global admin (can see/manage ALL data) |

**Used for:** System-wide permissions, accessing admin features

### 2. Organization Role (`account_member.member_role`)

Stored in the `account_member` table:

| Value | Role | Description |
|-------|------|-------------|
| 0 | Member | Can use organization resources (tokens, licenses) |
| 1 | Admin | Can manage organization members and resources |

**Used for:** Organization-specific permissions

### Combined Role Calculation

The `User` model combines both roles:

```php
// In User.php model
public function getRoleAttribute() {
    // Check global role first
    if ($this->attributes['role'] >= 1) {
        return $this->attributes['role']; // Return 1 or 2
    }

    // Check if admin of any organization
    $isOrgAdmin = AccountMember::where('member_id', $this->account_id)
        ->where('member_role', 1)
        ->exists();

    return $isOrgAdmin ? 1 : 0;
}
```

## Token Assignment & Usage

### How Tokens Work

**Key Principle:** Tokens are ALWAYS owned by an ACCOUNT, never by individual users.

### Assigning Tokens (Admin/SuperAdmin)

When a SuperAdmin assigns tokens:

```
POST /api/credits/add-manual
{
    "account_id": 42,        ← Account receives tokens
    "credits": 1000,
    "reason": "Promotional credit"
}
```

This adds 1000 tokens to account 42's balance. All members of account 42 can use these tokens.

### Purchasing Tokens (Users)

When a user purchases tokens:

```javascript
// Frontend sends:
{
    "package": "standard",
    "account_id": user.account_id  ← User's current account
}
```

The tokens are added to the account specified in `account_id`.

### Token Balance Check

To check available tokens:

```
GET /api/credits/balance/{accountId}

Response:
{
    "account_id": 42,
    "credits": 5000,           // Total purchased
    "credits_used": 1200,      // Already consumed
    "available_credits": 3800  // Remaining
}
```

## Common Use Cases

### Use Case 1: Individual Freelancer

**Setup:**
- User creates an account
- Buys 1000 tokens for their personal account
- Uses tokens for their own projects

**Structure:**
- 1 identity (the freelancer)
- 1 account (personal account)
- 0 account_member records (not part of any organization)

### Use Case 2: Small Company

**Setup:**
- Company admin creates an account
- Admin invites 5 employees
- Company buys 10,000 tokens for the organization account
- All employees share the token pool

**Structure:**
- 6 identities (1 admin + 5 employees)
- 7 accounts (6 personal accounts + 1 organization account)
- 6 account_member records (linking all 6 users to the organization)

### Use Case 3: Enterprise with Multiple Teams

**Setup:**
- Large company with multiple departments
- Each department has its own account/organization
- Some employees work across multiple departments
- Each department buys its own tokens

**Structure:**
- 100 identities (employees)
- 100 personal accounts + 5 department accounts = 105 accounts
- 150+ account_member records (employees in multiple departments)

## Important Notes

### For Developers

1. **Always use `account_id` for token operations**, not `identity.id`
2. When checking permissions, consider both global role and organization role
3. Tokens are at the account level, so all members share the balance
4. A user can be a member of multiple organizations simultaneously

### For Database Queries

**To get a user's available tokens:**
```sql
SELECT ac.credits, ac.credits_used, (ac.credits - ac.credits_used) as available
FROM account_credits ac
WHERE ac.account_id = [user's account_id]
```

**To get all organizations a user belongs to:**
```sql
SELECT a.*, am.member_role
FROM account a
INNER JOIN account_member am ON a.id = am.account_id
WHERE am.member_id = [user's account_id]
```

**To get all members of an organization:**
```sql
SELECT i.*, am.member_role
FROM identity i
INNER JOIN account_member am ON i.account_id = am.member_id
WHERE am.account_id = [organization's account_id]
```

## Migration from Old System

If you're migrating from a system where users directly owned tokens:

1. Create an account for each user (if not exists)
2. Move user's tokens to their personal account via `account_credits`
3. For organizations, create organization accounts
4. Link users to organizations via `account_member`
5. Consolidate tokens at the organization level

## FAQ

**Q: Can a user have tokens in multiple accounts?**
A: Yes! A user has their personal account with tokens, and can also be a member of organizations that have their own token pools.

**Q: What happens when I buy tokens?**
A: Tokens are added to the account specified in the purchase request (usually your personal `account_id`).

**Q: Can I transfer tokens between accounts?**
A: Not directly. A SuperAdmin can manually add/remove tokens from accounts using the admin interface.

**Q: Who can see an organization's tokens?**
A: All members of that organization can see the token balance. SuperAdmins can see all accounts' tokens.

**Q: What's the difference between `identity.id` and `account_id`?**
A: `identity.id` is your user ID. `account_id` is your personal account ID (usually the same number, but conceptually different). Use `account_id` for tokens/licenses.

## See Also

- [Database ERD](database-erd.svg) - Visual diagram of database relationships
- [Organization Structure](organization-structure.svg) - Visual diagram of account/member relationships
- [API Documentation](API.md) - API endpoints for account/token management
