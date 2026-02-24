
# Company Financial System Overhaul (v1.0.856)

## Problem

Every company type in the game allows hiring staff, buying upgrades, and purchasing equipment -- but none of these actions actually deduct money from the company balance or record a transaction. The actions succeed silently without any financial impact, making the business simulation unrealistic.

**All 7 subsidiary types are affected:**
- Security Firm (guards, upgrades)
- Merchandise Factory (workers, upgrades)
- Logistics Company (drivers, upgrades, vehicles)
- Venue (staff, upgrades)
- Rehearsal Studio (staff, equipment, upgrades)
- Recording Studio (staff, equipment, upgrades)
- Record Label (staff)

Additionally, the Security Firm management page never renders its upgrades panel.

The self-contract flow (offering your own band a deal and accepting it) is already working correctly.

## Solution

Create a shared utility function `deductCompanyBalance` and wire it into every hire/upgrade/equipment mutation. Each action will:
1. Look up the parent company from the subsidiary entity
2. Check the company has sufficient balance
3. Deduct the cost from the company balance
4. Record a `company_transactions` entry with the appropriate category and description

## Technical Details

### Step 1: Create a shared helper `src/hooks/useCompanyBalanceDeduction.ts`

A reusable function that:
- Takes `companyId`, `amount`, `description`, and `category`
- Fetches current company balance
- Throws if insufficient funds
- Updates `companies.balance`
- Inserts a `company_transactions` row (negative amount, type `expense`)
- Also export a helper to resolve `companyId` from a subsidiary entity (e.g., given a `security_firm_id`, look up the firm's `company_id`)

### Step 2: Fix each hook to deduct balance

**`src/hooks/useSecurityFirm.ts` -- `useHireGuard`**
- Before inserting guard, look up `security_firms.company_id` from `firmId`
- Calculate hiring cost (one-time fee = `salaryPerEvent * 10` as a signing bonus)
- Call `deductCompanyBalance`
- Record transaction: "Hired guard: {name}"

**`src/components/security/SecurityUpgradesManager.tsx` -- `installUpgradeMutation`**
- After computing `cost`, look up `company_id` from `security_firms`
- Call `deductCompanyBalance`
- Record transaction: "Security upgrade: {name} Lv{level}"

**`src/hooks/useMerchFactory.ts` -- `useHireWorker`**
- Look up `company_id` via `merch_factories.company_id` from `factory_id`
- Deduct hiring fee (weekly_salary * 4 as a month's advance)
- Record transaction: "Hired factory worker: {name}"

**`src/components/merch-factory/FactoryUpgradesManager.tsx` -- `installUpgradeMutation`**
- Look up `company_id` from `merch_factories`
- Call `deductCompanyBalance` with the upgrade cost

**`src/hooks/useLogisticsBusiness.ts` -- `useHireDriver`**
- Look up `company_id` from `logistics_companies`
- Deduct hiring fee (salary_per_day * 30)
- Record transaction

**`src/hooks/useLogisticsBusiness.ts` -- `usePurchaseLogisticsUpgrade`**
- Look up `company_id` from `logistics_companies`
- Deduct upgrade cost

**`src/hooks/useVenueBusiness.ts` -- `useHireVenueStaff`**
- Look up `company_id` from `venues`
- Deduct hiring fee (salary_weekly * 4)

**`src/hooks/useVenueBusiness.ts` -- `useInstallVenueUpgrade`**
- Look up `company_id` from `venues`
- Deduct the `cost` parameter

**`src/hooks/useRehearsalStudioBusiness.ts` -- `useHireRehearsalStaff`, `useAddRehearsalEquipment`, `useInstallRehearsalUpgrade`**
- Look up `company_id` via `rehearsal_rooms` -> `rehearsal_studios` -> `company_id`
- Deduct costs

**`src/hooks/useRecordingStudioBusiness.ts` -- `useHireRecordingStudioStaff`, `useAddRecordingStudioEquipment`, `useInstallRecordingStudioUpgrade`**
- Look up `company_id` via `recording_studios.company_id`
- Deduct costs

**`src/hooks/useLabelBusiness.ts` -- `useHireLabelStaff`**
- Look up `company_id` from `labels`
- Deduct hiring fee (salary_monthly as first month's pay)

### Step 3: Add the SecurityUpgradesManager to the SecurityFirmManagement page

`src/pages/SecurityFirmManagement.tsx` currently doesn't render the upgrades panel. Add it below the ContractsList with `companyBalance={company.balance}`.

### Step 4: Invalidate balance queries after mutations

Every mutation's `onSuccess` must also invalidate `company-balance` and `company-transactions` queries so the UI reflects the new balance immediately.

### Step 5: Update version to 1.0.856

Bump `VersionHeader.tsx` and add a changelog entry in `VersionHistory.tsx`.

## Files to modify
- **New**: `src/hooks/useCompanyBalanceDeduction.ts`
- `src/hooks/useSecurityFirm.ts`
- `src/hooks/useMerchFactory.ts`
- `src/hooks/useLogisticsBusiness.ts`
- `src/hooks/useVenueBusiness.ts`
- `src/hooks/useRehearsalStudioBusiness.ts`
- `src/hooks/useRecordingStudioBusiness.ts`
- `src/hooks/useLabelBusiness.ts`
- `src/components/security/SecurityUpgradesManager.tsx`
- `src/components/merch-factory/FactoryUpgradesManager.tsx`
- `src/pages/SecurityFirmManagement.tsx`
- `src/components/VersionHeader.tsx`
- `src/pages/VersionHistory.tsx`
