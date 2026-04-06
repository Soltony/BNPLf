# High-Level Design — Merchants, Districts & Branches

**Project:** BNPL Admin Portal  
**Version:** 1.0  
**Date:** April 4, 2026  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Module Decomposition](#3-module-decomposition)
4. [Data Model Overview](#4-data-model-overview)
5. [User Flows](#5-user-flows)
6. [Approval Workflow](#6-approval-workflow)
7. [Access Control Model](#7-access-control-model)
8. [Page Structure](#8-page-structure)
9. [Integration Points](#9-integration-points)

---

## 1. System Overview

The Merchants, Districts, and Branches modules form the **organizational hierarchy** of the BNPL platform:

```
District (geographic region)
  └── Branch (office/outlet)
        └── Merchant (business entity)
              ├── Items (products)
              ├── Discount Rules
              ├── Locations (stock locations)
              └── Users (merchant-scoped staff)
```

**Key Design Decisions:**
- **Districts & Branches** → Direct CRUD (no approval required)
- **Merchants** → All changes go through a **Maker-Checker** approval workflow via the `PendingChange` model
- **Branch scoping** → Branch-assigned users can only see and manage merchants within their branch

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                    │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  Districts &  │  │   Branch     │  │   Merchants    │ │
│  │  Branches     │  │   (Merchant  │  │   Approvals    │ │
│  │  Page         │  │   Mgmt)      │  │   Page         │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘ │
│         │                  │                   │          │
├─────────┼──────────────────┼───────────────────┼──────────┤
│         │           API Routes (Next.js)       │          │
│         │                  │                   │          │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌───────▼────────┐ │
│  │ /api/        │  │ /api/        │  │ /api/          │ │
│  │ districts    │  │ merchants    │  │ approvals      │ │
│  │ districts/   │  │ merchants/   │  │                │ │
│  │  branches    │  │  pending-    │  │                │ │
│  │ districts/   │  │  changes     │  │                │ │
│  │  branch-users│  │              │  │                │ │
│  │ districts/   │  │              │  │                │ │
│  │  branches/   │  │              │  │                │ │
│  │  bulk        │  │              │  │                │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘ │
│         │                  │                   │          │
├─────────┼──────────────────┼───────────────────┼──────────┤
│         │           Data Layer (Prisma)         │          │
│         │                  │                   │          │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌───────▼────────┐ │
│  │ District     │  │ Merchant     │  │ PendingChange  │ │
│  │ Branch       │  │ Item         │  │                │ │
│  │ User         │  │ DiscountRule │  │                │ │
│  └──────────────┘  └──────────────┘  └────────────────┘ │
│                                                           │
│                   Database (SQL Server)                    │
└─────────────────────────────────────────────────────────┘
```

**Tech Stack:**
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router), React, Tailwind CSS, shadcn/ui |
| API | Next.js API Routes (Route Handlers) |
| ORM | Prisma |
| Database | SQL Server (NVarChar for large JSON payloads) |
| Auth | Session-based (`getUserFromSession()`) |
| Audit | Custom audit log (`createAuditLog()`) |

---

## 3. Module Decomposition

### 3.1 Districts Module

| Aspect | Detail |
|--------|--------|
| **Page** | `/admin/districts` |
| **API** | `GET/POST/PUT/DELETE /api/districts` |
| **Model** | `District` |
| **Approval** | None — direct CRUD |
| **Relationships** | One-to-Many → Branch (cascade delete) |

### 3.2 Branches Module

| Aspect | Detail |
|--------|--------|
| **Page** | `/admin/districts` (right panel under selected district) |
| **API** | `GET/POST/PUT/DELETE /api/districts/branches` |
| **Bulk API** | `POST /api/districts/branches/bulk` |
| **Branch Users API** | `GET/POST/PUT/DELETE /api/districts/branch-users` |
| **Model** | `Branch` |
| **Approval** | None — direct CRUD |
| **Relationships** | Many-to-One → District; One-to-Many → User, Merchant, StockLocation |

### 3.3 Merchants Module

| Aspect | Detail |
|--------|--------|
| **Pages** | `/admin/branch` (CRUD), `/admin/merchants` (items, categories) |
| **API** | `GET/POST/PUT/DELETE /api/merchants` |
| **Pending Changes API** | `GET /api/merchants/pending-changes` |
| **Model** | `Merchant` |
| **Approval** | **Yes** — all CUD operations go through `PendingChange` |
| **Relationships** | Many-to-One → Branch; One-to-Many → Item, Order, User, DiscountRule, StockLocation |

### 3.4 Merchant Approvals Module

| Aspect | Detail |
|--------|--------|
| **List Page** | `/admin/merchants-approvals` |
| **Detail Page** | `/admin/merchants-approvals/[id]` |
| **API** | `GET/POST /api/approvals` |
| **Model** | `PendingChange` |
| **Entity Types** | Merchant, MerchantItem, MerchantDiscountRule, MerchantLocation |

---

## 4. Data Model Overview

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   District   │1    * │   Branch     │1    * │   Merchant   │
│──────────────│───────│──────────────│───────│──────────────│
│ id           │       │ id           │       │ id           │
│ name (unique)│       │ name         │       │ name (unique)│
│ status       │       │ districtId   │       │ accountNumber│
│              │       │ status       │       │ branchId     │
│              │       │              │       │ status       │
│              │       │ @@unique     │       │ bnplEnabled  │
│              │       │ (name,       │       │ contactPerson│
│              │       │  districtId) │       │   fields...  │
└──────────────┘       └──────────────┘       └──────┬───────┘
                                                     │1
                                               ┌─────┼─────┐
                                               │     │     │
                                              *│    *│    *│
                                         ┌─────┴┐ ┌──┴──┐ ┌┴────────┐
                                         │ Item │ │Order│ │Discount │
                                         │      │ │     │ │ Rule    │
                                         └──────┘ └─────┘ └─────────┘

┌──────────────────┐
│  PendingChange   │
│──────────────────│
│ id               │       Used by Merchants only.
│ entityType       │       Districts & Branches bypass this.
│ entityId         │
│ changeType       │       CREATE | UPDATE | DELETE
│ payload (JSON)   │       { created?, original?, updated? }
│ status           │       PENDING | APPROVED | REJECTED
│ createdById → User│
│ approvedById → User│
│ rejectionReason  │
└──────────────────┘
```

---

## 5. User Flows

### 5.1 District & Branch Management Flow

```
Admin opens /admin/districts
  ├── Tab 1: "Districts & Branches"
  │     ├── Left panel: District list (paginated, 10/page)
  │     │     ├── [Add] → Dialog → POST /api/districts → Instant creation
  │     │     ├── [Edit] → Dialog → PUT /api/districts → Instant update
  │     │     └── [Delete] → Confirm dialog → DELETE /api/districts → Cascade delete
  │     │
  │     └── Right panel: Branches for selected district
  │           ├── [Add Branch] → Dialog → POST /api/districts/branches
  │           ├── [Edit] → Dialog → PUT /api/districts/branches
  │           ├── [Delete] → Confirm → DELETE /api/districts/branches
  │           └── [Bulk Upload] → CSV/Excel → POST /api/districts/branches/bulk
  │
  └── Tab 2: "Branch User Access"
        ├── Create form: Full Name, Email, Phone, Password, Role, District → Branch
        ├── Users table: All branch users with edit/delete
        └── Edit dialog: Update branch, name, email, phone, status
```

### 5.2 Merchant Management Flow (Maker)

```
Branch User opens /admin/branch
  ├── Tab: "Merchants"
  │     ├── [Add Merchant] → Dialog with validation → POST /api/merchants
  │     │     └── Creates PendingChange (status: PENDING)
  │     │     └── Toast: "Submitted for approval"
  │     │
  │     ├── [Edit Merchant] → Dialog → PUT /api/merchants
  │     │     └── Creates PendingChange with original + updated
  │     │
  │     └── [Delete Merchant] → Confirm → DELETE /api/merchants
  │           └── Creates PendingChange (changeType: DELETE)
  │
  └── Pending changes visible on /admin/merchants (items page)
```

### 5.3 Merchant Approval Flow (Checker)

```
Approver opens /admin/merchants-approvals
  ├── Table of pending changes: Action, Entity, Name, Requester, Date
  │
  └── Click row → /admin/merchants-approvals/[id]
        ├── CREATE: Shows all proposed values
        ├── UPDATE: Shows changed fields (Before ↔ After diff)
        ├── DELETE: Shows entity to be removed
        │
        ├── [Approve] → POST /api/approvals { changeId, approved: true }
        │     ├── Merchant CREATE → prisma.merchant.upsert()
        │     ├── Merchant UPDATE → prisma.merchant.update()
        │     └── Merchant DELETE → Set status = "INACTIVE"
        │
        └── [Reject] → Dialog → Enter reason (required)
              └── POST /api/approvals { changeId, approved: false, rejectionReason }
```

---

## 6. Approval Workflow

### 6.1 Summary Matrix

| Entity | CREATE | UPDATE | DELETE | Approval Required? |
|--------|--------|--------|--------|-------------------|
| District | Direct | Direct | Direct (hard) | **No** |
| Branch | Direct | Direct | Direct (hard) | **No** |
| Merchant | PendingChange | PendingChange | PendingChange (soft) | **Yes** |
| MerchantItem | PendingChange | PendingChange | PendingChange | **Yes** |
| MerchantDiscountRule | PendingChange | PendingChange | PendingChange | **Yes** |
| MerchantLocation | PendingChange | PendingChange | PendingChange | **Yes** |

### 6.2 Maker-Checker Lifecycle

```
         ┌─────────┐
         │  MAKER   │
         │ submits  │
         │ change   │
         └────┬─────┘
              │
              ▼
     ┌────────────────┐
     │   PENDING      │
     │ (PendingChange)│
     └───────┬────────┘
             │
      ┌──────┴──────┐
      │   CHECKER   │
      │  reviews    │
      └──────┬──────┘
             │
     ┌───────┴───────┐
     │               │
     ▼               ▼
┌─────────┐   ┌──────────┐
│APPROVED │   │ REJECTED │
│         │   │          │
│ Entity  │   │ Reason   │
│ created/│   │ stored.  │
│ updated/│   │ Maker    │
│ deleted │   │ notified │
└─────────┘   └──────────┘
```

### 6.3 Constraints
- A user **cannot approve their own** submitted change.
- Rejection **requires a reason** (non-empty text).
- Merchant CREATE uses `upsert` on name to handle duplicate approvals gracefully.
- Merchant DELETE is a soft delete (status → `INACTIVE`), not a hard delete.

---

## 7. Access Control Model

### 7.1 Permission Mapping

```
Entity Type         → Module Permission Key(s)
─────────────────────────────────────────────
Merchant            → merchants, branch
MerchantItem        → merchants
MerchantDiscountRule→ merchants
MerchantLocation    → branch, merchants
District            → branch
Branch              → branch
```

### 7.2 Branch Scoping

- Users with a `branchId` are **branch-scoped**.
- Branch-scoped users:
  - `GET /api/merchants` → filtered to `WHERE branchId = user.branchId`
  - `PUT /api/merchants` → 403 if merchant.branchId ≠ user.branchId
  - `DELETE /api/merchants` → 403 if merchant.branchId ≠ user.branchId
  - Newly created merchants auto-inherit the user's branchId.
- HQ Admins (no branchId) see all data.

### 7.3 Page-Level Access

| Page | Permission Guard |
|------|-----------------|
| `/admin/districts` | `branch` module |
| `/admin/branch` | `branch` module |
| `/admin/merchants` | `merchants` module |
| `/admin/merchants-approvals` | `merchants-approvals` module |

---

## 8. Page Structure

### 8.1 Districts & Branches Page (`/admin/districts`)

```
┌─────────────────────────────────────────────────┐
│ Districts & Branches                             │
│ Manage districts, branches, and branch users.    │
├──────────────────┬──────────────────────────────┤
│ [Districts &     │ [Branch User Access]          │
│  Branches] (tab) │  (tab)                        │
├──────────────────┴──────────────────────────────┤
│                                                   │
│  ┌─────────────────┐  ┌─────────────────────────┐│
│  │ Districts Panel  │  │ Branches Panel          ││
│  │ [+ Add]          │  │ [+ Add] [Bulk Upload]   ││
│  │                  │  │                          ││
│  │ > District A (3) │  │ Branch Name | Status |   ││
│  │   District B (1) │  │ User Count | Actions    ││
│  │   District C (5) │  │                          ││
│  │                  │  │                          ││
│  │ [< 1 of 2 >]    │  │ [< 1 of 3 >]            ││
│  └─────────────────┘  └─────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### 8.2 Merchant Approvals Page (`/admin/merchants-approvals`)

```
┌─────────────────────────────────────────────────┐
│ Merchant Pending Approvals                       │
├─────────────────────────────────────────────────┤
│ Change Requests                                  │
│ Review and approve or reject merchant changes.   │
├──────┬────────┬──────┬────────┬──────┬──────────┤
│Action│Entity  │Name  │Req. By │Date  │ Actions  │
├──────┼────────┼──────┼────────┼──────┼──────────┤
│CREATE│Merchant│Acme  │John D. │2h ago│ [Review] │
│UPDATE│Item    │Phone │Jane S. │5h ago│ [Review] │
│DELETE│Location│Store1│Bob K.  │1d ago│ [Review] │
└──────┴────────┴──────┴────────┴──────┴──────────┘
```

### 8.3 Approval Detail Page (`/admin/merchants-approvals/[id]`)

```
┌─────────────────────────────────────────────────┐
│ [← Back to Approvals]                            │
│                                                   │
│ Merchant — New Request  [CREATE] [PENDING]       │
│ John Doe requested to create a new Merchant "X"  │
│ Submitted on April 03, 2026 at 14:30             │
├─────────────────────────────────────────────────┤
│ New Merchant Details                              │
│                                                   │
│ Name              │ Acme Corp                     │
│ Account Number    │ 7123456789012                 │
│ Contact Person    │ John Doe                      │
│ Contact Phone     │ 0911223344                    │
│ BNPL Enabled      │ Yes                           │
│ Status            │ ACTIVE                        │
├─────────────────────────────────────────────────┤
│                          [Reject]  [✓ Approve]   │
└─────────────────────────────────────────────────┘
```

---

## 9. Integration Points

| Integration | Direction | Description |
|-------------|-----------|-------------|
| Audit Log | Outbound | All CRUD operations log to `AuditLog` table via `createAuditLog()` |
| SMS Service | Outbound | Branch user creation sends SMS with credentials |
| Session Management | Inbound | `getUserFromSession()` for every API call |
| Permission System | Internal | `hasPermission()` / `hasPermissionForEntity()` for authorization |
| File Upload (Bulk) | Inbound | CSV/Excel parsing for bulk branch creation |
