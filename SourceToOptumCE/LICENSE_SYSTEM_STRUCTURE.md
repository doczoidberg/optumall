# License Management System Structure

## Overview
This is a multi-tenant license management system for OPTUM products. The system manages users, organizations (accounts), licenses, and seat assignments.

---

## Core Entities

### 1. **Identity (Users)**
- **Table:** `identity`
- **Purpose:** Represents individual users in the system
- **Key Fields:**
  - `id`: User ID
  - `email`: User's email
  - `user_name`: Username (typically same as email)
  - `password`: MD5 hashed password
  - `role`: Direct role assignment (0=user, 1=admin, 2=superadmin)
  - `account_id`: Links to the user's primary account/organization

**Role Priority:**
- If `identity.role = 2` → **Superadmin** (full system access)
- Else check `account_member.member_role`:
  - `member_role = 1` → **Admin** (organization admin)
  - `member_role = 0` → **User** (regular user)

---

### 2. **Account (Organizations)**
- **Table:** `account`
- **Purpose:** Represents organizations/companies
- **Key Fields:**
  - `id`: Account ID
  - `name`: Organization name
  - `domain`: Organization domain
  - `type`: Account type
  - `origin`: Where the account came from

**Example:**
- Account ID 4: "jkr@optumce.com"

---

### 3. **Product**
- **Table:** `product`
- **Purpose:** Defines available products that can be licensed
- **Key Fields:**
  - `id`: Product ID
  - `code`: Product code (e.g., "OPTUM_CS")
  - `name`: Product name (e.g., "OPTUM CS")
  - `description`: Product description

**Common Products:**
- OPTUM CS
- OPTUM MP
- OPTUM G2
- OPTUM G3

---

### 4. **License**
- **Table:** `license`
- **Purpose:** Represents a license granted to an organization for a product
- **Key Fields:**
  - `id`: License ID
  - `owner_id`: Account ID that owns the license
  - `product_id`: Which product is licensed
  - `seat_limit`: Maximum number of users/seats
  - `user_seat_limit`: Maximum users per seat
  - `node_limit`: Maximum nodes/devices
  - `expiry_date`: When the license expires
  - `watermark`: Optional watermark text
  - `description`: License description
  - `scheme_id`: Licensing scheme (how licenses are validated)
  - `assignment_policy`: How licenses are assigned to users
  - `automatic_assign`: Auto-assign seats (1=yes, 0=no)

**License Types (`type` field):**
- Different licensing models (trial, commercial, etc.)

---

### 5. **Assignment**
- **Table:** `assignment`
- **Purpose:** Links a license to a specific user
- **Key Fields:**
  - `id`: Assignment ID
  - `license_id`: Which license
  - `identity_id`: Which user is assigned
  - `data`: Additional assignment data (e.g., email, name)

**Flow:** License → Assignment → User

---

### 6. **Seat**
- **Table:** `seat`
- **Purpose:** Represents active license seats (activated instances)
- **Key Fields:**
  - `assignment_id`: Links to an assignment
  - `node_id`: Which device/node is using the seat
  - `lease_since`: When the seat was activated
  - `lease_until`: When the seat lease expires
  - `user_agent`: Device information

**Flow:** Assignment → Seat → Node (active usage tracking)

---

### 7. **Node**
- **Table:** `node`
- **Purpose:** Represents devices/machines using licenses
- **Key Fields:**
  - `id`: Node ID
  - `account_id`: Which account owns the node
  - `identity`: Unique device identifier (MAC address, etc.)
  - `sys_data`: System information

---

## Relationships Diagram

```
┌─────────────────┐
│    IDENTITY     │ (Users)
│  - id           │
│  - email        │
│  - role         │
│  - account_id ──┼──┐
└─────────────────┘  │
                     │
                     ↓
         ┌───────────────────┐
         │     ACCOUNT       │ (Organizations)
         │  - id             │
         │  - name           │
         │  - domain         │
         └───────┬───────────┘
                 │
                 │ owns
                 ↓
         ┌───────────────────┐
         │     LICENSE       │ (Product Licenses)
         │  - id             │
         │  - owner_id       │◄────┐
         │  - product_id ────┼──┐  │
         │  - seat_limit     │  │  │
         │  - expiry_date    │  │  │
         └───────┬───────────┘  │  │
                 │              │  │
                 │ assigned to  │  │
                 ↓              ↓  │
         ┌───────────────────┐ ┌──┴────────┐
         │   ASSIGNMENT      │ │  PRODUCT  │
         │  - id             │ │  - id     │
         │  - license_id     │ │  - name   │
         │  - identity_id    │ │  - code   │
         └───────┬───────────┘ └───────────┘
                 │
                 │ uses
                 ↓
         ┌───────────────────┐
         │      SEAT         │ (Active Sessions)
         │  - id             │
         │  - assignment_id  │
         │  - node_id ───────┼──┐
         │  - lease_until    │  │
         └───────────────────┘  │
                                ↓
                        ┌───────────────┐
                        │     NODE      │ (Devices)
                        │  - id         │
                        │  - identity   │
                        └───────────────┘
```

---

## Multi-Tenancy: Account Membership

Users can belong to multiple organizations through `account_member`:

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  IDENTITY   │         │  ACCOUNT_MEMBER  │         │   ACCOUNT   │
│  - id       │◄────────┤  - member_id     │────────►│  - id       │
│  - email    │         │  - account_id    │         │  - name     │
└─────────────┘         │  - member_role   │         └─────────────┘
                        └──────────────────┘
                         (0=user, 1=admin)
```

**Note:** The `identity.account_id` is the PRIMARY account, but users can be members of other accounts via `account_member`.

---

## Groups (Organization Units)

Organizations can have groups (departments, teams):

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   ACCOUNT   │◄──────┤ GROUP_MEMBER │──────►│ ACCOUNT_    │
│  - id       │       │ - account_id │       │   GROUP     │
└─────────────┘       │ - group_id   │       │  - id       │
                      └──────────────┘       │  - name     │
                                             └─────────────┘
```

---

## How Licenses Work

### License Creation Flow:
1. **Superadmin creates a license:**
   - Select a `product_id` (e.g., OPTUM CS)
   - Assign to an `owner_id` (account/organization)
   - Set limits: `seat_limit`, `node_limit`, `expiry_date`
   - Set `watermark` (optional custom text shown in the product)
   - Set `description` (license identifier)

2. **License Assignment:**
   - A user in the organization can be assigned the license
   - Creates an `assignment` record linking `license_id` to `identity_id`

3. **Seat Activation:**
   - When the user activates the license on their device
   - A `node` record is created for their device
   - A `seat` record is created linking the assignment to the node
   - The `seat` has a lease period (`lease_since` to `lease_until`)

4. **License Validation:**
   - The application checks:
     - Is the license expired? (`expiry_date`)
     - Are there available seats? (`seat_limit` vs active `seat` records)
     - Is the device authorized? (check `node` and `seat`)

---

## Example: Real Data for jkr@optumce.com

### User:
- **User ID:** 30
- **Email:** jkr@optumce.com
- **Role:** 1 (Admin)
- **Account ID:** 4

### Organization:
- **Account ID:** 4
- **Account Name:** "jkr@optumce.com"

### Licenses Owned by Account 4:
1. **License #55:** OPTUM MP (1 seat, expires 2025-11-20)
2. **License #223:** OPTUM G3 (1 seat, expires 2020-07-31) ⚠️ EXPIRED
3. **License #3682:** OPTUM G2 (1 seat, expires 2020-12-30) ⚠️ EXPIRED

---

## Common Operations

### 1. Create a New License
```sql
INSERT INTO license (
    owner_id,        -- Account ID
    product_id,      -- Product to license
    seat_limit,      -- Max seats
    user_seat_limit, -- Users per seat
    node_limit,      -- Max devices
    expiry_date,     -- Expiration date
    watermark,       -- Optional watermark
    description,     -- License description
    life_cycle,      -- Lifecycle stage
    type             -- License type
) VALUES (
    4,               -- Account 4
    1,               -- OPTUM CS
    5,               -- 5 seats
    1,               -- 1 user per seat
    5,               -- 5 nodes
    '2026-12-31',    -- Expires end of 2026
    'DEMO',          -- Watermark
    'Demo License',  -- Description
    1,               -- Active
    1                -- Commercial
);
```

### 2. Assign License to User
```sql
INSERT INTO assignment (license_id, identity_id, data)
VALUES (12345, 30, 'jkr@optumce.com');
```

### 3. Check Active Seats for a License
```sql
SELECT
    s.id,
    s.lease_since,
    s.lease_until,
    i.email,
    n.identity as device_id
FROM seat s
JOIN assignment a ON s.assignment_id = a.id
JOIN identity i ON a.identity_id = i.id
JOIN node n ON s.node_id = n.id
WHERE a.license_id = 12345
AND s.lease_until > NOW();
```

### 4. Set User as Superadmin
```sql
UPDATE identity
SET role = 2
WHERE email = 'user@example.com';
```

### 5. Add User to Organization as Admin
```sql
INSERT INTO account_member (account_id, member_id, member_role)
VALUES (4, 30, 1);  -- 1 = admin, 0 = user
```

---

## Security Notes

⚠️ **Current Password Hashing:** The system uses MD5 hashing (configured in `config/hashing.php`). This is **insecure** but currently the system standard.

MD5 password for "admin123": `0192023a7bbd73250516f069df18b500`

---

## Key Files

### Backend:
- **User Model:** `backend/licensemanagement/app/Models/User.php`
- **Auth Controller:** `backend/licensemanagement/app/Http/Controllers/AuthController.php`
- **License Controller:** `backend/licensemanagement/app/Http/Controllers/LicenseController.php`
- **Hashing Config:** `backend/licensemanagement/config/hashing.php`
- **MD5 Hasher:** `backend/licensemanagement/app/Helpers/Hasher/MD5Hasher.php`

### Database:
- All tables in `license_local` database
- Main tables: `identity`, `account`, `license`, `product`, `assignment`, `seat`, `node`

---

## Summary

The license system is a **multi-tenant** platform where:

1. **Organizations (Accounts)** own **Licenses** for **Products**
2. **Users (Identities)** belong to **Accounts** and can be assigned **Licenses**
3. **Licenses** have seat limits and expiration dates
4. When a user activates a license on a **Device (Node)**, a **Seat** is created
5. **Seats** track active license usage with lease periods
6. **Roles** control what users can do:
   - **Superadmin (role=2)**: Full system access
   - **Admin (role=1 or member_role=1)**: Manage their organization
   - **User (role=0)**: Use assigned licenses

The system tracks license usage, enforces seat limits, and manages license expiration.
