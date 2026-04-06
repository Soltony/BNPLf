# Low-Level Design — Merchants, Districts & Branches

**Project:** BNPL Admin Portal  
**Version:** 1.0  
**Date:** April 4, 2026  

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [API Specification](#2-api-specification)
3. [Component Architecture](#3-component-architecture)
4. [Approval Engine Logic](#4-approval-engine-logic)
5. [Validation Rules](#5-validation-rules)
6. [Error Handling](#6-error-handling)
7. [File Inventory](#7-file-inventory)

---

## 1. Database Schema

### 1.1 District Table

```prisma
model District {
  id        String   @id @default(cuid())
  name      String   @unique
  status    String   @default("ACTIVE")       // "ACTIVE" | "INACTIVE"
  branches  Branch[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 1.2 Branch Table

```prisma
model Branch {
  id             String          @id @default(cuid())
  name           String
  districtId     String
  district       District        @relation(fields: [districtId], references: [id], onDelete: Cascade)
  status         String          @default("ACTIVE")   // "ACTIVE" | "INACTIVE"
  stockLocations StockLocation[]
  users          User[]
  merchants      Merchant[]
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@unique([name, districtId])
}
```

### 1.3 Merchant Table

```prisma
model Merchant {
  id                    String   @id @default(cuid())
  name                  String   @unique
  accountNumber         String?  @unique
  branchId              String?
  branch                Branch?  @relation(fields: [branchId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  iconUrl               String?  @db.Text
  contactPersonName     String?
  contactPersonPhone    String?
  contactPersonEmail    String?
  additionalContactInfo String?  @db.Text
  bnplEnabled           Boolean  @default(true)
  status                String   @default("PENDING_APPROVAL")  // "ACTIVE" | "INACTIVE" | "PENDING_APPROVAL"
  items                 Item[]
  orders                Order[]
  users                 User[]
  discountRules         DiscountRule[]
  stockLocations        StockLocation[]
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### 1.4 PendingChange Table

```prisma
model PendingChange {
  id              String    @id @default(cuid())
  entityType      String                        // "Merchant", "MerchantItem", etc.
  entityId        String?                       // null for CREATE
  changeType      String                        // "CREATE" | "UPDATE" | "DELETE"
  payload         String    @db.NVarChar(Max)   // JSON string
  status          String    @default("PENDING") // "PENDING" | "APPROVED" | "REJECTED"
  createdById     String
  createdBy       User      @relation("CreatedBy", fields: [createdById], references: [id])
  approvedById    String?
  approvedBy      User?     @relation("ApprovedBy", fields: [approvedById], references: [id])
  approvedAt      DateTime?
  rejectionReason String?   @db.Text
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([status])
  @@index([entityType])
}
```

### 1.5 Payload JSON Structures

**CREATE payload:**
```json
{
  "created": {
    "name": "Merchant Name",
    "accountNumber": "7123456789012",
    "contactPersonName": "John",
    "contactPersonPhone": "0911223344",
    "contactPersonEmail": "john@example.com",
    "additionalContactInfo": null,
    "bnplEnabled": true,
    "status": "ACTIVE",
    "branchId": "clxyz123...",
    "iconUrl": null
  }
}
```

**UPDATE payload:**
```json
{
  "original": {
    "name": "Old Name",
    "accountNumber": "7123456789012",
    "status": "ACTIVE",
    ...
  },
  "updated": {
    "name": "New Name",
    "accountNumber": "7123456789012",
    "status": "ACTIVE",
    ...
  }
}
```

**DELETE payload:**
```json
{
  "original": {
    "id": "clxyz...",
    "name": "Merchant Name",
    "status": "ACTIVE",
    ...
  }
}
```

---

## 2. API Specification

### 2.1 Districts API — `/api/districts`

#### GET `/api/districts`

| Item | Detail |
|------|--------|
| Auth | `branch.read` |
| Query Params | None |
| Response 200 | `District[]` with `_count.branches` |
| Ordering | `name ASC` |

```typescript
// Response shape
[
  {
    "id": "clxyz...",
    "name": "Addis Ababa",
    "status": "ACTIVE",
    "_count": { "branches": 5 },
    "createdAt": "2026-01-01T..."
  }
]
```

#### POST `/api/districts`

| Item | Detail |
|------|--------|
| Auth | `branch.create` |
| Body | `{ name: string, status?: string }` |
| Validation | `name` required, non-empty |
| Response 201 | Created `District` with `_count` |
| Error 409 | `"A district with this name already exists"` (Prisma P2002) |
| Audit | `CREATE_DISTRICT` |

#### PUT `/api/districts`

| Item | Detail |
|------|--------|
| Auth | `branch.update` |
| Body | `{ id: string, name: string, status?: string }` |
| Validation | `id` required, `name` required |
| Response 200 | Updated `District` with `_count` |
| Error 409 | Duplicate name |
| Audit | `UPDATE_DISTRICT` |

#### DELETE `/api/districts?id=<id>`

| Item | Detail |
|------|--------|
| Auth | `branch.delete` |
| Query Params | `id` (required) |
| Behavior | Hard delete; cascade deletes all branches |
| Response 200 | `{ success: true }` |
| Audit | `DELETE_DISTRICT` |

---

### 2.2 Branches API — `/api/districts/branches`

#### GET `/api/districts/branches?districtId=<id>`

| Item | Detail |
|------|--------|
| Auth | `branch.read` |
| Query Params | `districtId` (optional) |
| Response 200 | `Branch[]` with `district` and `_count.users` |
| Ordering | `name ASC` |

#### POST `/api/districts/branches`

| Item | Detail |
|------|--------|
| Auth | `branch.create` |
| Body | `{ name: string, districtId: string, status?: string }` |
| Validation | `name` required, `districtId` required |
| Response 201 | Created `Branch` with `district` and `_count` |
| Error 409 | `"A branch with this name already exists in this district"` |
| Audit | `CREATE_BRANCH` |

#### PUT `/api/districts/branches`

| Item | Detail |
|------|--------|
| Auth | `branch.update` |
| Body | `{ id: string, name: string, districtId?: string, status?: string }` |
| Response 200 | Updated `Branch` |
| Error 409 | Duplicate (name, districtId) |
| Audit | `UPDATE_BRANCH` |

#### DELETE `/api/districts/branches?id=<id>`

| Item | Detail |
|------|--------|
| Auth | `branch.delete` |
| Behavior | Hard delete |
| Response 200 | `{ success: true }` |
| Audit | `DELETE_BRANCH` |

---

### 2.3 Bulk Branch Upload — `POST /api/districts/branches/bulk`

| Item | Detail |
|------|--------|
| Auth | `branch.create` |
| Content-Type | `multipart/form-data` |
| Body | `file` (CSV/Excel), `districtId` (string) |
| Behavior | Parse file → create branches; skip duplicates |
| Response 200 | `{ total: number, created: number, skipped: string[] }` |

---

### 2.4 Branch Users API — `/api/districts/branch-users`

#### GET `/api/districts/branch-users?branchId=<id>`

| Item | Detail |
|------|--------|
| Auth | `branch.read` |
| Query Params | `branchId` (optional) |
| Response 200 | `BranchUser[]` — id, fullName, email, phoneNumber, role, status, branchId, branchName, districtName |

#### POST `/api/districts/branch-users`

| Item | Detail |
|------|--------|
| Auth | `branch.create` |
| Body | `{ fullName, email, phoneNumber, password?, role, branchId, status }` |
| Side Effect | Sends SMS with credentials |
| Response 201 | Created user |

#### PUT `/api/districts/branch-users`

| Item | Detail |
|------|--------|
| Auth | `branch.update` |
| Body | `{ id, branchId, fullName, email, phoneNumber, status }` |
| Response 200 | Updated user |

#### DELETE `/api/districts/branch-users?id=<id>`

| Item | Detail |
|------|--------|
| Auth | `branch.delete` |
| Behavior | Hard delete |
| Response 200 | `{ success: true }` |

---

### 2.5 Merchants API — `/api/merchants`

#### GET `/api/merchants`

| Item | Detail |
|------|--------|
| Auth | Authenticated user |
| Branch Scoping | `WHERE branchId = user.branchId` (if user is branch-scoped) |
| Response 200 | `Merchant[]` ordered by `createdAt DESC` |

#### POST `/api/merchants` (Create → PendingChange)

| Item | Detail |
|------|--------|
| Auth | `merchants.create` OR `branch.create` |
| Body | See [Validation Rules §5.1](#51-merchant-field-validation) |
| Behavior | Creates `PendingChange` with `changeType: "CREATE"` |
| Response 201 | `PendingChange` object |
| Audit | `CREATE_MERCHANT_REQUEST` |

**Internal logic:**
```typescript
const pending = await prisma.pendingChange.create({
  data: {
    entityType: 'Merchant',
    changeType: 'CREATE',
    payload: JSON.stringify({ created: { ...validatedFields, branchId: user.branchId || null } }),
    createdById: user.id,
  },
});
```

#### PUT `/api/merchants` (Update → PendingChange)

| Item | Detail |
|------|--------|
| Auth | `merchants.update` OR `branch.update` |
| Body | `{ id, ...updatedFields }` |
| Branch Guard | 403 if `user.branchId && existing.branchId !== user.branchId` |
| Behavior | Fetches existing merchant → creates `PendingChange` with `original` + `updated` |
| Response 200 | `PendingChange` object |
| Audit | `UPDATE_MERCHANT_REQUEST` |

**Internal logic:**
```typescript
const existing = await prisma.merchant.findUnique({ where: { id } });
// ... validate ...
const pending = await prisma.pendingChange.create({
  data: {
    entityType: 'Merchant',
    entityId: id,
    changeType: 'UPDATE',
    payload: JSON.stringify({
      original: existing,
      updated: { /* merged fields */ },
    }),
    createdById: user.id,
  },
});
```

#### DELETE `/api/merchants?id=<id>` (Delete → PendingChange)

| Item | Detail |
|------|--------|
| Auth | `merchants.delete` OR `branch.delete` |
| Branch Guard | 403 if `user.branchId && existing.branchId !== user.branchId` |
| Behavior | Fetches existing → creates `PendingChange` with `original` payload |
| Response 200 | `PendingChange` object |
| Audit | `DELETE_MERCHANT_REQUEST` |

---

### 2.6 Approvals API — `POST /api/approvals`

| Item | Detail |
|------|--------|
| Auth | `merchants-approvals.update` OR `approvals.update` |
| Body | `{ changeId: string, approved: boolean, rejectionReason?: string }` |

**Approval Processing (Merchant entity):**

```typescript
switch (entityType) {
  case "Merchant":
    if (changeType === "CREATE") {
      // Upsert keyed on name to avoid unique constraint violations
      await prisma.merchant.upsert({
        where: { name: merchantData.name },
        create: { ...merchantData, status: merchantData.status ?? "ACTIVE" },
        update: { ...merchantData, status: merchantData.status ?? "ACTIVE" },
      });
    } else if (changeType === "UPDATE") {
      await prisma.merchant.update({
        where: { id: entityId },
        data: { ...data.updated },
      });
    } else if (changeType === "DELETE") {
      // Soft delete
      await prisma.merchant.update({
        where: { id: entityId },
        data: { status: "INACTIVE" },
      });
    }
    break;
}

// Update PendingChange status
await prisma.pendingChange.update({
  where: { id: changeId },
  data: {
    status: approved ? "APPROVED" : "REJECTED",
    approvedById: user.id,
    approvedAt: approved ? new Date() : undefined,
    rejectionReason: approved ? undefined : rejectionReason,
  },
});
```

### 2.7 Pending Changes API — `GET /api/merchants/pending-changes`

| Item | Detail |
|------|--------|
| Auth | Authenticated user |
| Filters | `entityType IN ("MerchantItem", "MerchantDiscountRule", "MerchantLocation")`, `createdById = user.id`, `status IN ("PENDING", "REJECTED")` |
| Response 200 | `PendingChange[]` with rejection reasons |

---

## 3. Component Architecture

### 3.1 Districts Page — `src/app/admin/districts/page.tsx`

**Type:** Client component (`'use client'`)  
**Permission Guard:** `useRequirePermission('branch')`

```
DistrictsPage (client)
├── State Management
│   ├── districts: District[] — fetched from /api/districts
│   ├── selectedDistrict: District | null
│   ├── branches: Branch[] — fetched when district selected
│   ├── branchUsers: BranchUser[] — fetched on tab switch
│   ├── allBranches: Branch[] — for user form dropdowns
│   └── roles: Role[] — filtered to "Branch" role only
│
├── Tab: "Districts & Branches"
│   ├── Districts Panel (left, lg:col-span-2)
│   │   ├── District list (paginated 10/page)
│   │   ├── Add District Dialog (name, status)
│   │   ├── Edit District Dialog (pre-filled)
│   │   └── Delete District AlertDialog (with cascade warning)
│   │
│   └── Branches Panel (right, lg:col-span-3)
│       ├── Branch list for selectedDistrict (paginated 10/page)
│       ├── Add Branch Dialog (name, status)
│       ├── Edit Branch Dialog (pre-filled)
│       ├── Delete Branch AlertDialog
│       └── Bulk Upload Dialog (file input, CSV/Excel)
│
└── Tab: "Branch User Access"
    ├── Create User Form (inline card)
    │   ├── District dropdown → filters Branch dropdown
    │   ├── Fields: fullName, email, phone, password, role, branch
    │   └── Submit → POST /api/districts/branch-users
    │
    ├── Users Table
    │   ├── Columns: Name, Email, Phone, Branch, District, Role, Status, Actions
    │   └── Actions: Edit, Delete
    │
    └── Edit User Dialog
        ├── District dropdown → filters Branch dropdown
        ├── Fields: fullName, email, phone, branch, status
        └── Submit → PUT /api/districts/branch-users
```

**Fetch Dependencies:**
```
Page mount → fetchDistricts()
Tab switch to "Branch User Access" → fetchBranchUsers(), fetchAllBranches(), fetchRoles()
District selected → fetchBranches(districtId)
```

### 3.2 Merchant Approvals List — `src/app/admin/merchants-approvals/`

```
MerchantApprovalsPage (server component)
│   └── Fetches PendingChange records where:
│       status = "PENDING"
│       entityType IN ["Merchant", "MerchantItem", "MerchantDiscountRule", "MerchantLocation"]
│   └── Serializes dates to ISO strings
│
└── MerchantApprovalsClient (client component)
    ├── Permission Guard: useRequirePermission('merchants-approvals')
    ├── Table: Action, Entity, Name, Requested By, Date, Status, Actions
    ├── Badge colors: CREATE=emerald, UPDATE=blue, DELETE=red
    ├── Name extraction: parsed from payload JSON (created.name || updated.name)
    └── Row click / Review button → /admin/merchants-approvals/[id]
```

### 3.3 Merchant Approval Detail — `src/app/admin/merchants-approvals/[id]/`

```
MerchantApprovalDetailPage (server component)
│   └── Fetches single PendingChange by ID
│   └── Sanitizes payload (strips password fields)
│   └── Derives entityName from payload
│
└── MerchantApprovalDetailClient (client component)
    ├── Permission Guard: useRequirePermission('merchants-approvals')
    ├── canProcess: merchants-approvals.update OR approvals.update
    │
    ├── Header: Entity type, change type badge, status badge, description, date
    │
    ├── Rejection Banner (if status=REJECTED): red card with AlertTriangle icon
    │
    ├── CREATE View: Field-value grid of all proposed fields
    │   └── Skips: id, createdAt, updatedAt, merchant, category, discountRules, etc.
    │
    ├── UPDATE View: Side-by-side diff of changed fields
    │   ├── Compares original vs updated via JSON.stringify comparison
    │   ├── Before (red-50 background) | After (green-50 background)
    │   └── Only shows fields that actually changed
    │
    ├── DELETE View: Full entity details in destructive-bordered card
    │
    ├── Field Renderers:
    │   ├── imageUrl/iconUrl → Thumbnail grid (20x20 rounded images)
    │   ├── boolean → Badge (Yes/No)
    │   ├── price/value → Formatted ETB currency
    │   ├── sellingOption → Human-readable badge
    │   ├── variants → Nested table (Name, Size, Color, Material, Price, Status)
    │   ├── optionGroups → Grouped badges with price deltas
    │   ├── ISO date strings → Formatted with date-fns
    │   └── Objects → JSON pretty-print fallback
    │
    ├── Action Buttons (if PENDING + canProcess):
    │   ├── [Approve] → POST /api/approvals { changeId, approved: true }
    │   └── [Reject] → Opens Dialog
    │
    └── Reject Dialog:
        ├── Textarea for reason (required, non-empty)
        ├── [Cancel] button
        └── [Reject] button → POST /api/approvals { changeId, approved: false, rejectionReason }
```

**Field Label Mapping (FIELD_LABELS constant):**

| Key | Label |
|-----|-------|
| name | Name |
| accountNumber | Account Number |
| contactPersonName | Contact Person |
| contactPersonPhone | Contact Phone |
| contactPersonEmail | Contact Email |
| additionalContactInfo | Additional Contact Info |
| bnplEnabled | BNPL Enabled |
| status | Status |
| iconUrl | Icon |
| price | Price (ETB) |
| sellingOption | Selling Option |
| variants | Variants |
| optionGroups | Option Groups (Attributes) |

**Skipped Fields (SKIP_FIELDS set):**  
`id`, `createdAt`, `updatedAt`, `merchant`, `category`, `discountRules`, `orderItems`, `inventoryLevels`, `combinationInventoryLevels`

---

## 4. Approval Engine Logic

### 4.1 PendingChange Creation (Maker Side)

```
Merchant POST /api/merchants
  1. Authenticate user (session)
  2. Check permission: merchants.create OR branch.create
  3. Validate all input fields (see §5.1)
  4. Create PendingChange:
     - entityType: "Merchant"
     - changeType: "CREATE"
     - payload: JSON.stringify({ created: { ...fields, branchId: user.branchId } })
     - createdById: user.id
  5. Write audit log: CREATE_MERCHANT_REQUEST
  6. Return PendingChange (201)

Merchant PUT /api/merchants
  1. Authenticate + authorize
  2. Fetch existing merchant (404 if not found)
  3. Branch guard: 403 if user.branchId !== existing.branchId
  4. Validate updated fields
  5. Create PendingChange:
     - entityType: "Merchant"
     - entityId: existing.id
     - changeType: "UPDATE"
     - payload: { original: existing, updated: { ...mergedFields } }
  6. Write audit log: UPDATE_MERCHANT_REQUEST
  7. Return PendingChange (200)

Merchant DELETE /api/merchants?id=<id>
  1. Authenticate + authorize
  2. Fetch existing merchant (404 if not found)
  3. Branch guard
  4. Create PendingChange:
     - entityType: "Merchant"
     - entityId: existing.id
     - changeType: "DELETE"
     - payload: { original: existing }
  5. Write audit log: DELETE_MERCHANT_REQUEST
  6. Return PendingChange (200)
```

### 4.2 PendingChange Processing (Checker Side)

```
POST /api/approvals
  1. Authenticate user
  2. Fetch PendingChange by changeId
  3. Verify status === "PENDING"
  4. Self-approval check: createdById !== user.id
  5. Parse payload JSON

  If approved === true:
    6a. Switch on entityType:
        "Merchant" + CREATE → prisma.merchant.upsert (keyed on name)
        "Merchant" + UPDATE → prisma.merchant.update (by entityId)
        "Merchant" + DELETE → prisma.merchant.update status="INACTIVE"
    7a. Update PendingChange: status="APPROVED", approvedById, approvedAt

  If approved === false:
    6b. Validate rejectionReason is non-empty
    7b. Update PendingChange: status="REJECTED", rejectionReason
```

### 4.3 Sensitive Field Sanitization

Before rendering payloads in the detail page, the server component strips fields:
- `password`
- Any key containing `password` (case-insensitive)
- `passwordHash`
- `hashedPassword`
- `pass`

```typescript
const removeSensitiveFields = (obj: any): any => {
  for (const k of Object.keys(obj)) {
    if (k === 'password' || k.toLowerCase().includes('password') || 
        k === 'passwordHash' || k === 'hashedPassword' || k === 'pass') continue;
    out[k] = (typeof v === 'object' && v !== null) ? removeSensitiveFields(v) : v;
  }
  return out;
};
```

---

## 5. Validation Rules

### 5.1 Merchant Field Validation

| Field | Rule | Error Message |
|-------|------|--------------|
| name | Non-empty after trim | `"Name is required"` |
| accountNumber | Non-empty, regex `^7\d{12}$` | `"Account number must start with 7 and be 13 characters long"` |
| contactPersonName | Non-empty after trim | `"Contact person name is required"` |
| contactPersonPhone | Non-empty, regex `^(09\d{8}\|9\d{8}\|\+2519\d{8})$` | `"Invalid Ethiopian phone format"` |
| contactPersonEmail | If provided, regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` | `"Invalid email address"` |

### 5.2 District Validation

| Field | Rule | Error Message |
|-------|------|--------------|
| name | Non-empty after trim | `"Name is required"` |
| name (unique) | Database constraint | `"A district with this name already exists"` |

### 5.3 Branch Validation

| Field | Rule | Error Message |
|-------|------|--------------|
| name | Non-empty after trim | `"Name is required"` |
| districtId | Required, valid FK | `"District is required"` |
| (name, districtId) | Database unique constraint | `"A branch with this name already exists in this district"` |

---

## 6. Error Handling

### 6.1 HTTP Status Codes

| Code | Scenario |
|------|----------|
| 200 | Successful read/update/delete |
| 201 | Successful creation |
| 400 | Validation error (missing/invalid field) |
| 403 | Not authenticated or insufficient permissions |
| 404 | Entity not found |
| 409 | Unique constraint violation (Prisma P2002) |
| 500 | Unexpected server error |

### 6.2 Error Response Format

```json
{ "error": "Human-readable error message" }
```

### 6.3 Client-Side Error Handling

All API calls in the client components follow the pattern:

```typescript
try {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed');
  }
  toast({ title: 'Success message' });
} catch (e: any) {
  toast({ title: 'Error', description: e.message, variant: 'destructive' });
}
```

---

## 7. File Inventory

### 7.1 Pages

| File | Type | Purpose |
|------|------|---------|
| `src/app/admin/districts/page.tsx` | Client | Districts & Branches management (tabs: districts+branches, branch users) |
| `src/app/admin/branch/page.tsx` | Client | Branch-level merchant management (tabs: merchants, users, categories) |
| `src/app/admin/merchants/page.tsx` | Client | Merchant items management (items, discount rules, orders, locations) |
| `src/app/admin/merchants-approvals/page.tsx` | Server | Merchant approvals list (fetches pending changes) |
| `src/app/admin/merchants-approvals/client.tsx` | Client | Merchant approvals table UI |
| `src/app/admin/merchants-approvals/[id]/page.tsx` | Server | Single approval detail (fetches + sanitizes payload) |
| `src/app/admin/merchants-approvals/[id]/client.tsx` | Client | Approval detail UI (review, approve, reject) |

### 7.2 API Routes

| File | Methods | Purpose |
|------|---------|---------|
| `src/app/api/districts/route.ts` | GET, POST, PUT, DELETE | District CRUD (direct) |
| `src/app/api/districts/branches/route.ts` | GET, POST, PUT, DELETE | Branch CRUD (direct) |
| `src/app/api/districts/branches/bulk/route.ts` | POST | Bulk branch upload (CSV/Excel) |
| `src/app/api/districts/branch-users/route.ts` | GET, POST, PUT, DELETE | Branch user management |
| `src/app/api/merchants/route.ts` | GET, POST, PUT, DELETE | Merchant CRUD (via PendingChange) |
| `src/app/api/merchants/pending-changes/route.ts` | GET | Maker's pending/rejected changes |
| `src/app/api/approvals/route.ts` | GET, POST | Approval processing (approve/reject) |

### 7.3 Library Files

| File | Purpose |
|------|---------|
| `src/lib/permissions.ts` | Permission checking: `hasPermission()`, `hasPermissionForEntity()`, `entityTypeToPermissionKeys()` |
| `src/lib/audit-log.ts` | `createAuditLog()` — writes structured audit entries |
| `src/lib/user.ts` | `getUserFromSession()` — session-based auth |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/types.ts` | TypeScript interfaces: `Merchant`, `MerchantStatus`, `Permissions` |

### 7.4 Hooks

| File | Purpose |
|------|---------|
| `src/hooks/use-require-permission.tsx` | Redirects user if missing required module permission |
| `src/hooks/use-permissions.tsx` | `canModule(module, action)` — client-side permission check |
