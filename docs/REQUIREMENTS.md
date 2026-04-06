# Requirements Document — Merchants, Districts & Branches

**Project:** BNPL Admin Portal  
**Version:** 1.0  
**Date:** April 4, 2026  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Merchants Module](#2-merchants-module)
3. [Districts Module](#3-districts-module)
4. [Branches Module](#4-branches-module)
5. [Merchant Approvals Module](#5-merchant-approvals-module)
6. [Non-Functional Requirements](#6-non-functional-requirements)

---

## 1. Introduction

### 1.1 Purpose

This document captures the functional and non-functional requirements for the **Merchants**, **Districts**, **Branches**, and related **Merchant Approvals** modules within the BNPL Admin Portal.

### 1.2 Scope

These modules enable administrators and branch-scoped users to manage the organizational hierarchy (Districts → Branches → Merchants) and enforce a maker-checker approval workflow for merchant-level changes.

### 1.3 Actors

| Actor | Description |
|-------|-------------|
| **HQ Admin** | Full access to all modules. Can create, update, delete, and approve across all districts, branches, and merchants. |
| **Branch User** | Scoped to their assigned branch. Can manage merchants within their branch and submit changes for approval. |
| **Approver** | Reviews and approves/rejects pending merchant change requests. Cannot approve their own requests. |

---

## 2. Merchants Module

### 2.1 Functional Requirements

#### FR-M-01: List Merchants
- The system shall display all merchants in a tabular format.
- Branch-scoped users shall only see merchants belonging to their branch.
- Each merchant row shall display: Name, Account Number, Contact Person, Phone, Email, BNPL Enabled, Status.

#### FR-M-02: Create Merchant (via Approval)
- The system shall **not** directly create a merchant. Instead, a `PendingChange` record of type `CREATE` shall be created.
- Required fields:
  - **Name** (unique, non-empty)
  - **Account Number** (must match pattern `7XXXXXXXXXXXX` — starts with `7`, 13 digits total)
  - **Contact Person Name** (non-empty)
  - **Contact Person Phone** (valid Ethiopian format: `09XXXXXXXX`, `9XXXXXXXX`, or `+2519XXXXXXXX`)
- Optional fields:
  - Icon URL (image/base64 or URL)
  - Contact Person Email (valid email format)
  - Additional Contact Info (free text)
  - BNPL Enabled (boolean, defaults to `true`)
  - Status (defaults to `ACTIVE`)
- The `branchId` shall be automatically set from the logged-in user's branch (if branch-scoped).
- An audit log entry `CREATE_MERCHANT_REQUEST` shall be written.

#### FR-M-03: Update Merchant (via Approval)
- The system shall create a `PendingChange` record of type `UPDATE` with both `original` and `updated` payloads.
- All validation rules from FR-M-02 shall apply to updated fields.
- Branch-scoped users shall only update merchants in their branch.
- An audit log entry `UPDATE_MERCHANT_REQUEST` shall be written.

#### FR-M-04: Delete Merchant (via Approval)
- The system shall create a `PendingChange` record of type `DELETE` with the `original` payload.
- Branch-scoped users shall only delete merchants in their branch.
- Upon approval, the merchant shall be **soft-deleted** (status set to `INACTIVE`).
- An audit log entry `DELETE_MERCHANT_REQUEST` shall be written.

#### FR-M-05: Merchant Items Management
- The Merchants page shall display items organized by merchant.
- Pending create requests shall be shown inline with an approval status indicator.
- Each item links to related sub-entities: Discount Rules, Orders, Locations, Variants.

### 2.2 Data Requirements

| Field | Type | Constraints |
|-------|------|-------------|
| id | String (CUID) | Primary key, auto-generated |
| name | String | Unique, required |
| accountNumber | String | Unique, optional, pattern: `7\d{12}` |
| branchId | String | FK → Branch (nullable) |
| iconUrl | Text | Optional, base64 or URL |
| contactPersonName | String | Optional |
| contactPersonPhone | String | Optional, Ethiopian phone format |
| contactPersonEmail | String | Optional, valid email |
| additionalContactInfo | Text | Optional |
| bnplEnabled | Boolean | Default: `true` |
| status | String | `ACTIVE` \| `INACTIVE` \| `PENDING_APPROVAL`, default: `PENDING_APPROVAL` |
| createdAt | DateTime | Auto-set |
| updatedAt | DateTime | Auto-set |

### 2.3 Permission Requirements

| Action | Required Permission |
|--------|-------------------|
| List Merchants | Authenticated user (branch-scoped filtering) |
| Create Merchant | `merchants.create` OR `branch.create` |
| Update Merchant | `merchants.update` OR `branch.update` |
| Delete Merchant | `merchants.delete` OR `branch.delete` |

---

## 3. Districts Module

### 3.1 Functional Requirements

#### FR-D-01: List Districts
- The system shall display all districts sorted alphabetically by name.
- Each district shall show: Name, Status (ACTIVE/INACTIVE), Branch Count.
- The list shall be paginated (10 items per page).

#### FR-D-02: Create District
- The system shall directly create a district (no approval workflow).
- Required fields:
  - **Name** (unique, non-empty)
- Optional fields:
  - **Status** (defaults to `ACTIVE`)
- A unique constraint violation shall return error `"A district with this name already exists"`.
- An audit log entry `CREATE_DISTRICT` shall be written.

#### FR-D-03: Update District
- The system shall allow updating the name and status of a district.
- Required fields: `id`, `name`.
- Unique constraint on name shall be enforced.
- An audit log entry `UPDATE_DISTRICT` shall be written.

#### FR-D-04: Delete District
- The system shall permanently delete a district (hard delete).
- Cascading delete: all branches under the district shall also be deleted (`onDelete: Cascade`).
- An audit log entry `DELETE_DISTRICT` shall be written.
- A confirmation dialog shall be displayed: *"This will permanently delete this district and all its branches."*

#### FR-D-05: District Selection
- Selecting a district in the left panel shall load its branches in the right panel.
- Re-selecting the same district shall deselect it.

### 3.2 Data Requirements

| Field | Type | Constraints |
|-------|------|-------------|
| id | String (CUID) | Primary key, auto-generated |
| name | String | Unique, required |
| status | String | `ACTIVE` \| `INACTIVE`, default: `ACTIVE` |
| createdAt | DateTime | Auto-set |
| updatedAt | DateTime | Auto-set |

### 3.3 Permission Requirements

| Action | Required Permission |
|--------|-------------------|
| List Districts | `branch.read` |
| Create District | `branch.create` |
| Update District | `branch.update` |
| Delete District | `branch.delete` |

### 3.4 Approval Workflow

**Districts do NOT have an approval workflow.** All CRUD operations are applied directly.

---

## 4. Branches Module

### 4.1 Functional Requirements

#### FR-B-01: List Branches
- The system shall display branches for a selected district.
- Each branch shall show: Name, Status, User Count.
- The list shall be paginated (10 items per page).
- If no `districtId` is provided, all branches shall be returned.

#### FR-B-02: Create Branch
- The system shall directly create a branch (no approval workflow).
- Required fields:
  - **Name** (non-empty)
  - **District ID** (valid FK)
- Optional fields:
  - **Status** (defaults to `ACTIVE`)
- Unique constraint: `(name, districtId)` — no duplicate branch names within the same district.
- An audit log entry `CREATE_BRANCH` shall be written.

#### FR-B-03: Update Branch
- The system shall allow updating name, districtId, and status.
- Unique constraint on `(name, districtId)` shall be enforced.
- An audit log entry `UPDATE_BRANCH` shall be written.

#### FR-B-04: Delete Branch
- The system shall permanently delete a branch (hard delete).
- An audit log entry `DELETE_BRANCH` shall be written.

#### FR-B-05: Bulk Branch Upload
- The system shall accept a CSV or Excel file to create multiple branches at once.
- A `districtId` must be provided alongside the file.
- Duplicates shall be skipped (not cause failure).
- The response shall report: total, created count, and list of skipped names.

#### FR-B-06: Branch User Management
- The system shall allow creating users scoped to a specific branch.
- Required fields: Full Name, Email, Phone Number, Role (restricted to "Branch" role), Branch ID.
- Optional: Password (auto-generated if not provided).
- SMS with credentials shall be sent upon user creation.
- Users can be edited (branch, name, email, phone, status) and deleted.

### 4.2 Data Requirements

| Field | Type | Constraints |
|-------|------|-------------|
| id | String (CUID) | Primary key, auto-generated |
| name | String | Required |
| districtId | String | FK → District, required |
| status | String | `ACTIVE` \| `INACTIVE`, default: `ACTIVE` |
| createdAt | DateTime | Auto-set |
| updatedAt | DateTime | Auto-set |

**Unique Constraint:** `@@unique([name, districtId])`

**Relationships:**
- Many-to-One → District (cascade delete)
- One-to-Many → User, Merchant, StockLocation

### 4.3 Permission Requirements

| Action | Required Permission |
|--------|-------------------|
| List Branches | `branch.read` |
| Create Branch | `branch.create` |
| Update Branch | `branch.update` |
| Delete Branch | `branch.delete` |
| List Branch Users | `branch.read` |
| Create Branch User | `branch.create` |
| Update Branch User | `branch.update` |
| Delete Branch User | `branch.delete` |

### 4.4 Approval Workflow

**Branches do NOT have an approval workflow.** All CRUD operations are applied directly.

---

## 5. Merchant Approvals Module

### 5.1 Functional Requirements

#### FR-MA-01: List Pending Merchant Approvals
- The system shall display all `PendingChange` records with:
  - `status = "PENDING"`
  - `entityType IN ("Merchant", "MerchantItem", "MerchantDiscountRule", "MerchantLocation")`
- Each row shall display: Change Type (CREATE/UPDATE/DELETE), Entity Type, Name, Requested By, Date, Status.
- Rows shall be sorted by creation date descending.

#### FR-MA-02: View Approval Detail
- Clicking a pending change shall navigate to `/admin/merchants-approvals/[id]`.
- **CREATE** requests shall display all proposed field values.
- **UPDATE** requests shall display a side-by-side diff (Before vs After) of changed fields only.
- **DELETE** requests shall display the current entity values being deleted.
- Sensitive fields (password, passwordHash) shall be stripped from the payload.

#### FR-MA-03: Approve a Change
- Approvers shall click "Approve" to apply the pending change.
- **Self-approval is prohibited**: a user cannot approve their own submitted change.
- On approval:
  - Merchant CREATE → `prisma.merchant.upsert` (keyed on name to prevent duplicates).
  - Merchant UPDATE → `prisma.merchant.update`.
  - Merchant DELETE → Soft delete (set status to `INACTIVE`).
- The `PendingChange` record shall be updated to `status: "APPROVED"`, with `approvedById` and `approvedAt`.

#### FR-MA-04: Reject a Change
- Approvers shall click "Reject" and must provide a **rejection reason** (mandatory, non-empty).
- The `PendingChange` record shall be updated to `status: "REJECTED"` with the `rejectionReason`.
- Rejected changes shall display a red banner with the rejection reason on the detail page.

#### FR-MA-05: View Pending/Rejected Changes (Maker View)
- The maker (submitter) shall be able to view their own pending and rejected changes via `/api/merchants/pending-changes`.
- Filtered by: `entityType IN ("MerchantItem", "MerchantDiscountRule", "MerchantLocation")` and `createdById = current user`.

### 5.2 Data Requirements — PendingChange Model

| Field | Type | Constraints |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| entityType | String | `Merchant`, `MerchantItem`, `MerchantDiscountRule`, `MerchantLocation`, etc. |
| entityId | String | Null for CREATE; set for UPDATE/DELETE |
| changeType | String | `CREATE` \| `UPDATE` \| `DELETE` |
| payload | NVarChar(Max) | JSON: `{ original?, updated?, created? }` |
| status | String | `PENDING` \| `APPROVED` \| `REJECTED`, default: `PENDING` |
| createdById | String | FK → User (the maker) |
| approvedById | String | FK → User (the checker), nullable |
| approvedAt | DateTime | Nullable |
| rejectionReason | Text | Nullable |
| createdAt | DateTime | Auto-set |
| updatedAt | DateTime | Auto-set |

**Indexes:** `status`, `entityType`

### 5.3 Permission Requirements

| Action | Required Permission |
|--------|-------------------|
| View Merchant Approvals List | `merchants-approvals.read` |
| View Approval Detail | `merchants-approvals.read` |
| Approve/Reject | `merchants-approvals.update` OR `approvals.update` |

---

## 6. Non-Functional Requirements

### NFR-01: Security
- All API endpoints shall verify the user session via `getUserFromSession()`.
- Unauthorized requests shall return HTTP 403.
- Branch-scoped users shall only access resources within their assigned branch.
- Sensitive fields (passwords) shall be stripped from approval payloads before rendering.

### NFR-02: Audit Trail
- All CRUD operations (including approval requests) shall produce an audit log entry with: actor ID, action, entity, entity ID, and details.

### NFR-03: Data Integrity
- Unique constraints shall be enforced at the database level (district name, merchant name, branch name+district).
- Prisma error code `P2002` shall be caught and returned as a user-friendly 409 Conflict response.

### NFR-04: Pagination
- District and branch lists shall be paginated with a page size of 10.

### NFR-05: Validation
- All input validation (phone format, email, account number) shall be performed server-side in the API route before creating any database records.

### NFR-06: Soft Delete
- Merchants shall use soft delete (status → `INACTIVE`).
- Districts and branches shall use hard delete with cascade.
