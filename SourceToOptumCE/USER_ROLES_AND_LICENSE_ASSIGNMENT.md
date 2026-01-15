# User Roles & License Assignment Guide

## Part 1: How User Roles Are Set

### Role System Overview

The system uses a **two-tier role system**:

1. **Global Role** (`identity.role` field)
   - 0 = Regular User
   - 1 = Admin
   - 2 = **Superadmin** (full system access)

2. **Organization Role** (`account_member.member_role` field)
   - 0 = Organization User
   - 1 = Organization Admin

### Role Priority Logic

The effective role is determined by this order (see [User.php:114-123](c:\SourceToOptumCE\backend\licensemanagement\app\Models\User.php#L114-L123)):

```php
public function getRoleAttribute()
{
    // 1. Check for super admin first (identity.role = 2)
    if (isset($this->attributes['role']) && $this->attributes['role'] == 2) {
        return 2;  // SUPERADMIN - overrides everything
    }

    // 2. Check organization membership role (account_member.member_role)
    $this->fetchMemberData();
    $isadmin = $this->member_data != NULL && $this->member_data->member_role == 1;
    return $isadmin ? 1 : 0;  // ADMIN or USER
}
```

**In practice:**
- If `identity.role = 2` → User is **Superadmin** (sees and controls everything)
- Else if `account_member.member_role = 1` → User is **Admin** (manages their organization)
- Else → User is **Regular User** (can only use assigned licenses)

---

## How to Set User Roles

### Method 1: Set Superadmin Role (Global)

**SQL (Direct Database):**
```sql
UPDATE identity
SET role = 2
WHERE email = 'user@example.com';
```

**Who can do this:** Database administrator or system admin

**Example:**
```sql
-- Make info@seoaachen.de a superadmin
UPDATE identity SET role = 2 WHERE email = 'info@seoaachen.de';
```

---

### Method 2: Set Organization Admin Role

**API Endpoint:** `POST /api/users/changerole`

**Controller:** [UserController.php:488-524](c:\SourceToOptumCE\backend\licensemanagement\app\Http\Controllers\UserController.php#L488-L524)

**Who can do this:** Organization admins (role >= 1)

**Request:**
```json
{
  "user_id": 123,
  "role_id": 1   // 1 = admin, 0 = user
}
```

**What it does:**
```php
// Updates the account_member table
$account_member = AccountMember::where('member_id', $userToChange->account_id)
    ->where('account_id', $accountMember->account_id)
    ->first();

$account_member->member_role = $request->input('role_id');  // 0 or 1
$account_member->save();
```

**SQL Equivalent:**
```sql
-- Make user an admin of organization 4
UPDATE account_member
SET member_role = 1
WHERE member_id = 30    -- User's account_id
  AND account_id = 4;   -- Organization account_id
```

---

### Method 3: Set Role During User Creation

**When admin creates a user** ([AccountController.php:53-120](c:\SourceToOptumCE\backend\licensemanagement\app\Http\Controllers\AccountController.php#L53-L120)):
```php
// Always creates as regular user (role = 0)
$user->role = 0;

// Member role in organization is also 0 (user)
$account_member->member_role = 0;
```

**When accepting invitation** ([AuthController.php:298-306](c:\SourceToOptumCE\backend\licensemanagement\app\Http\Controllers\AuthController.php#L298-L306)):
```php
// Invitation can specify admin role
$newAccountMember->member_role = $invitation->as_admin ? 1 : 0;
```

---

### Method 4: Direct SQL (Manual)

**Make user superadmin:**
```sql
UPDATE identity SET role = 2 WHERE id = 30;
```

**Make user organization admin:**
```sql
-- First, check if they're a member
SELECT * FROM account_member
WHERE member_id = 30 AND account_id = 4;

-- If exists, update role
UPDATE account_member
SET member_role = 1
WHERE member_id = 30 AND account_id = 4;

-- If doesn't exist, add them as admin
INSERT INTO account_member (account_id, member_id, member_role)
VALUES (4, 30, 1);
```

---

## Role Capabilities

| Role | identity.role | account_member.member_role | Capabilities |
|------|---------------|----------------------------|--------------|
| **Superadmin** | 2 | any | - See ALL licenses<br>- See ALL users<br>- Manage any organization<br>- Full system access |
| **Admin** | 0 or 1 | 1 | - See organization licenses<br>- Manage organization users<br>- Assign licenses to users<br>- Change user roles in org |
| **User** | 0 | 0 or NULL | - See own licenses<br>- Activate licenses on devices<br>- Manage own profile |

**Code References:**
- Superadmin check: [LicenseController.php:278](c:\SourceToOptumCE\backend\licensemanagement\app\Http\Controllers\LicenseController.php#L278)
- Admin check: [UserController.php:89](c:\SourceToOptumCE\backend\licensemanagement\app\Http\Controllers\UserController.php#L89)

---

## Part 2: How Licenses Are Assigned to Accounts

### License Assignment Flow

```
1. LICENSE CREATION (Owner)
   ↓
2. ASSIGNMENT (User Link)
   ↓
3. ACTIVATION (Device Seat)
```

---

### Step 1: Create License for an Account (Owner)

**Important:** The license system appears to create licenses externally or through batch imports. There's commented-out code in [LicenseController.php:227-243](c:\SourceToOptumCE\backend\licensemanagement\app\Http\Controllers\LicenseController.php#L227-L243) that shows the structure:

```php
License::create([
    'owner_id' => $account_id,           // The organization that owns the license
    'product_id' => $scheme->product_id, // Which product (OPTUM CS, OPTUM MP, etc.)
    'seat_limit' => $scheme->seat_limit, // Max seats
    'user_seat_limit' => $scheme->user_seat_limit,
    'node_limit' => $scheme->node_limit,
    'instance_limit' => $scheme->instance_limit,
    'text' => $scheme->text,
    'type' => $scheme->type,
    'scheme_id' => $scheme->id,          // Licensing scheme
    'features' => $scheme->features,
    'assignment_policy' => $scheme->assignment_policy,
    'can_renewal' => $scheme->can_renewal,
    'expiry_date' => $expiry_date,       // When license expires
]);
```

**Manual SQL Creation:**
```sql
-- Example: Create a license for account 4 (jkr@optumce.com)
INSERT INTO license (
    owner_id,           -- Account ID that owns this license
    product_id,         -- Product ID (1=OPTUM CS, 2=OPTUM MP, etc.)
    seat_limit,         -- Max number of seats
    user_seat_limit,    -- Users per seat
    node_limit,         -- Max devices
    instance_limit,     -- Max instances
    life_cycle,         -- Lifecycle stage (1=active)
    support_until,      -- Support end date
    expiry_date,        -- License expiration
    scheme_id,          -- Licensing scheme ID
    type,               -- License type
    watermark,          -- Optional watermark text
    description,        -- License description
    assignment_policy,  -- How to assign (0=manual, 1=auto)
    automatic_assign,   -- Auto-assign new users (1=yes, 0=no)
    arbitrary_domain,   -- Allow any domain (1=yes, 0=no)
    created_date
) VALUES (
    4,                  -- jkr@optumce.com account
    1,                  -- OPTUM CS product
    10,                 -- 10 seats
    1,                  -- 1 user per seat
    10,                 -- 10 nodes/devices
    1,                  -- 1 instance
    1,                  -- Active
    '2026-12-31',       -- Support until
    '2026-12-31',       -- Expires Dec 31, 2026
    NULL,               -- No scheme
    1,                  -- Commercial license
    'DEMO',             -- Watermark
    'Test License #1',  -- Description
    0,                  -- Manual assignment
    0,                  -- No auto-assign
    0,                  -- No arbitrary domain
    NOW()
);
```

**Get Product IDs:**
```sql
SELECT id, code, name FROM product;
-- Results:
-- 1 | OPTUM_CS | OPTUM CS
-- 2 | OPTUM_MP | OPTUM MP
-- 3 | OPTUM_G2 | OPTUM G2
-- 4 | OPTUM_G3 | OPTUM G3
```

---

### Step 2: Assign License to Users in Organization

Once a license is owned by an organization, it needs to be assigned to specific users.

**API Endpoint:** `POST /api/licenses/assign`

**Controller:** [LicenseController.php:462-534](c:\SourceToOptumCE\backend\licensemanagement\app\Http\Controllers\LicenseController.php#L462-L534)

**Who can do this:** Organization admins or superadmins

**Request:**
```json
{
  "licenseId": 12345,
  "userList": [
    {
      "id": 30,
      "email": "jkr@optumce.com",
      "name": "John Doe"
    }
  ]
}
```

**What it does:**
```php
// Creates assignment record
$newAssignment = new Assignment;
$newAssignment->license_id = $request->input('licenseId');
$newAssignment->account_id = $user->account_id;  // User's primary account
$newAssignment->save();
```

**Manual SQL:**
```sql
-- Assign license 12345 to user ID 30 (via their account)
INSERT INTO assignment (license_id, account_id, created_date)
VALUES (
    12345,  -- License ID
    4,      -- User's account_id (from identity.account_id)
    NOW()
);
```

**Check assignments:**
```sql
SELECT
    a.id,
    a.license_id,
    l.description as license_desc,
    p.name as product,
    i.email as user_email,
    acc.name as account_name
FROM assignment a
JOIN license l ON a.license_id = l.id
JOIN product p ON l.product_id = p.id
JOIN identity i ON a.account_id = i.account_id
JOIN account acc ON a.account_id = acc.id
WHERE a.license_id = 12345;
```

---

### Step 3: User Activates License (Creates Seat)

When a user runs the OPTUM software and activates their license:

1. **Software sends activation request** with:
   - License ID
   - Device information (MAC address, CPU ID, etc.)
   - User credentials

2. **System creates NODE** (device record):
```sql
INSERT INTO node (account_id, identity, sys_data, created_date)
VALUES (4, 'MAC:00:11:22:33:44:55', 'System info', NOW());
```

3. **System creates SEAT** (active license usage):
```sql
INSERT INTO seat (assignment_id, node_id, lease_since, lease_until, user_agent, created_date)
VALUES (
    123,              -- Assignment ID
    456,              -- Node ID (device)
    NOW(),            -- Lease start
    NOW() + INTERVAL 30 DAY,  -- Lease end (30 days)
    'OptumG3_2023_2.3.8',     -- Software version
    NOW()
);
```

4. **System validates:**
   - Is license expired? (`license.expiry_date > NOW()`)
   - Are seats available? (`COUNT(active seats) < license.seat_limit`)
   - Is node limit exceeded? (`COUNT(nodes) < license.node_limit`)

---

## Complete Example: Setting Up a License for an Organization

### Scenario: Give "Acme Corp" a license for OPTUM CS

```sql
-- Step 1: Find or create the organization
SELECT id, name FROM account WHERE name = 'Acme Corp';
-- Result: id = 100

-- Step 2: Create the license
INSERT INTO license (
    owner_id, product_id, seat_limit, user_seat_limit, node_limit,
    instance_limit, life_cycle, expiry_date, type, description,
    assignment_policy, automatic_assign, created_date
) VALUES (
    100,                -- Acme Corp account ID
    1,                  -- OPTUM CS
    5,                  -- 5 seats
    1,                  -- 1 user per seat
    5,                  -- 5 devices
    1,                  -- 1 instance
    1,                  -- Active
    '2026-12-31',       -- Expires end of 2026
    1,                  -- Commercial
    'Acme Corp License', -- Description
    0,                  -- Manual assignment
    0,                  -- No auto-assign
    NOW()
);
-- Result: license ID = 50000

-- Step 3: Find users in the organization
SELECT
    i.id,
    i.email,
    i.account_id
FROM identity i
JOIN account_member am ON i.account_id = am.member_id
WHERE am.account_id = 100;

-- Result: User john@acme.com has account_id = 1001

-- Step 4: Assign license to user
INSERT INTO assignment (license_id, account_id, created_date)
VALUES (50000, 1001, NOW());

-- Step 5: Verify assignment
SELECT
    l.id as license_id,
    l.description,
    p.name as product,
    i.email as assigned_user,
    l.seat_limit,
    l.expiry_date
FROM assignment a
JOIN license l ON a.license_id = l.id
JOIN product p ON l.product_id = p.id
JOIN identity i ON a.account_id = i.account_id
WHERE l.id = 50000;
```

---

## Automatic Assignment

If `license.automatic_assign = 1`:

**API Endpoint:** `POST /api/licenses/automatic_assign`

**Controller:** [LicenseController.php:436-460](c:\SourceToOptumCE\backend\licensemanagement\app\Http\Controllers\LicenseController.php#L436-L460)

**What it does:**
- Automatically assigns the license to all users in the organization
- Useful for organization-wide licenses

---

## Quick Reference SQL Commands

### Check user's role:
```sql
SELECT
    i.id,
    i.email,
    i.role as global_role,
    am.member_role as org_role,
    CASE
        WHEN i.role = 2 THEN 'Superadmin'
        WHEN am.member_role = 1 THEN 'Admin'
        ELSE 'User'
    END as effective_role
FROM identity i
LEFT JOIN account_member am ON i.account_id = am.member_id
WHERE i.email = 'user@example.com';
```

### Check user's licenses:
```sql
SELECT
    l.id,
    l.description,
    p.name as product,
    l.seat_limit,
    l.expiry_date,
    a.created_date as assigned_date
FROM assignment a
JOIN license l ON a.license_id = l.id
JOIN product p ON l.product_id = p.id
JOIN identity i ON a.account_id = i.account_id
WHERE i.email = 'user@example.com';
```

### Check organization's licenses:
```sql
SELECT
    l.id,
    l.description,
    p.name as product,
    l.seat_limit,
    COUNT(DISTINCT a.id) as assigned_users,
    COUNT(DISTINCT s.id) as active_seats,
    l.expiry_date
FROM license l
JOIN product p ON l.product_id = p.id
LEFT JOIN assignment a ON l.id = a.license_id
LEFT JOIN seat s ON a.id = s.assignment_id AND s.lease_until > NOW()
WHERE l.owner_id = 4  -- Organization account ID
GROUP BY l.id;
```

### Make user superadmin:
```sql
UPDATE identity SET role = 2 WHERE email = 'admin@example.com';
```

### Make user organization admin:
```sql
UPDATE account_member
SET member_role = 1
WHERE member_id = (SELECT account_id FROM identity WHERE email = 'user@example.com')
  AND account_id = 4;  -- Organization ID
```

---

## Summary

**Setting User Roles:**
1. **Superadmin:** Update `identity.role = 2` (SQL only)
2. **Org Admin:** Update `account_member.member_role = 1` (API or SQL)
3. **User:** Default is 0, no action needed

**Assigning Licenses:**
1. **Create License:** SQL (no API endpoint currently active) → Sets `owner_id` to organization
2. **Assign to Users:** API `/api/licenses/assign` or SQL → Creates `assignment` records
3. **Activate:** User runs software → Creates `seat` and `node` records

The system tracks everything through these relationships:
```
Account (Org) → owns → License → assigned to → User (via Assignment) → uses on → Device (Seat/Node)
```
