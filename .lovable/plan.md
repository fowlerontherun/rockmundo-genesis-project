
# Underworld & Company Admin Enhancement Plan

## Overview
This plan addresses gaps in admin management for the Underworld and Company systems, ensuring admins can fully edit and control underworld products, crypto tokens, and company subsidiaries.

## Phase 1: Complete Underworld Admin Features (v1.0.495)

### 1.1 Add Underworld Admin to Navigation
- **File**: `src/components/admin/AdminNav.tsx`
- Add entry under "Economy & Resources" category:
  ```
  { path: "/admin/underworld", label: "Underworld", description: "Shadow Store & Crypto" }
  ```

### 1.2 Enhance Crypto Token Management
- **File**: `src/pages/admin/UnderworldAdmin.tsx`
- Add full edit dialog for tokens (similar to products):
  - Edit name, symbol, description
  - Manual price input (not just +5%/-5%)
  - Edit volume and market cap
  - Delete token functionality
- Add price simulation button (randomize within range)
- Add bulk price volatility toggle

### 1.3 Add Purchase History & Analytics Tab
- **File**: `src/pages/admin/UnderworldAdmin.tsx`
- New tab showing:
  - Recent purchases across all users
  - Revenue totals by product
  - Most popular products
  - Active boosts count

---

## Phase 2: Company Subsidiary Admin Pages (v1.0.496)

### 2.1 Security Firms Admin Page
- **New File**: `src/pages/admin/SecurityFirmsAdmin.tsx`
- Features:
  - List all security firms across all companies
  - View/edit firm details (license level, equipment, reputation)
  - Manage guards globally (view, adjust stats)
  - View all active contracts
  - Link to parent company
- Add to navigation under "System & Configuration"

### 2.2 Merch Factories Admin Page  
- **New File**: `src/pages/admin/MerchFactoriesAdmin.tsx`
- Features:
  - List all factories across all companies
  - View/edit factory details (capacity, quality level, operating costs)
  - Manage workers globally
  - View production queues
  - View product catalogs
- Add to navigation under "System & Configuration"

### 2.3 Logistics Companies Admin Page
- **New File**: `src/pages/admin/LogisticsCompaniesAdmin.tsx`
- Features:
  - List all logistics companies across all companies
  - View/edit company details (fleet capacity, license tier)
  - Manage fleets and drivers globally
  - View active contracts
  - Track delivery metrics
- Add to navigation under "System & Configuration"

---

## Phase 3: Enhance Company Admin (v1.0.497)

### 3.1 Edit Company Functionality
- **File**: `src/pages/admin/CompanyAdmin.tsx`
- Add edit dialog for companies:
  - Edit name
  - Inject/remove funds (admin balance adjustment)
  - Change status (active/suspended)
  - Clear bankruptcy flag manually
  - Transfer ownership

### 3.2 Financial Overview Tab
- Add consolidated view of:
  - Total payroll across all subsidiaries
  - Daily operating costs
  - Revenue streams
  - Profit/loss projections

### 3.3 Subsidiary Quick Links
- From company row, add quick links to:
  - View/manage security firms
  - View/manage factories
  - View/manage logistics
  - View/manage labels

---

## Technical Implementation Details

### Database Changes
None required - all tables already exist with proper structure.

### New Files to Create
1. `src/pages/admin/SecurityFirmsAdmin.tsx`
2. `src/pages/admin/MerchFactoriesAdmin.tsx`
3. `src/pages/admin/LogisticsCompaniesAdmin.tsx`

### Files to Modify
1. `src/components/admin/AdminNav.tsx` - Add new navigation items
2. `src/pages/admin/UnderworldAdmin.tsx` - Enhance token editing
3. `src/pages/admin/CompanyAdmin.tsx` - Add edit capabilities
4. `src/App.tsx` - Add routes for new admin pages
5. `src/components/VersionHeader.tsx` - Update version
6. `src/pages/VersionHistory.tsx` - Add changelog entries

### Route Additions
```tsx
<Route path="admin/underworld" element={<UnderworldAdmin />} /> // Already exists, verify
<Route path="admin/security-firms" element={<SecurityFirmsAdmin />} />
<Route path="admin/merch-factories" element={<MerchFactoriesAdmin />} />
<Route path="admin/logistics-companies" element={<LogisticsCompaniesAdmin />} />
```

---

## Admin Navigation Updates

### New Entries in AdminNav.tsx

**Economy & Resources:**
```js
{ path: "/admin/underworld", label: "Underworld", description: "Shadow Store & Crypto" }
```

**System & Configuration:**
```js
{ path: "/admin/security-firms", label: "Security Firms", description: "Global firm management" },
{ path: "/admin/merch-factories", label: "Merch Factories", description: "Factory administration" },
{ path: "/admin/logistics-companies", label: "Logistics", description: "Fleet & delivery management" }
```

---

## Summary

| Phase | Version | Scope |
|-------|---------|-------|
| 1 | v1.0.495 | Complete Underworld Admin (nav link, token editing, analytics) |
| 2 | v1.0.496 | New subsidiary admin pages (Security, Merch, Logistics) |
| 3 | v1.0.497 | Enhanced Company Admin (edit, financials, links) |

This phased approach allows for incremental testing and ensures each system is fully manageable by admins before moving to the next.
