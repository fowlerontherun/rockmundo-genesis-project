
# Company & Subsidiary System Overhaul

## Version: 1.0.501

## Overview
This comprehensive update fixes critical issues with the company system and adds essential business management features. The company empire system will become a fully functional business simulation.

---

## Current Problems

| Issue | Impact |
|-------|--------|
| Creating subsidiaries doesn't create the actual business entities | Security firms, factories, logistics companies don't exist in their respective tables |
| No creation costs | Companies are free to create, no economic impact |
| Companies start with $0 | No initial capital means immediate bankruptcy risk |
| No deposit/withdraw funds | Owners can't manage company finances |
| No tax system | Missing realistic business costs |
| Navigation confusion | "Manage" goes to generic detail page, not specialized management |

---

## Implementation Plan

### Phase 1: Fix Subsidiary Creation (Critical)

**Problem**: When creating a company of type `security`, `factory`, or `logistics`, only a `companies` table record is created. No corresponding record is created in `security_firms`, `merch_factories`, or `logistics_companies`.

**Solution**: Create a database trigger OR modify `useCreateCompany` hook to automatically create the subsidiary entity after the company is created.

**Database Migration**:
- Add trigger function `create_subsidiary_entity()` that fires AFTER INSERT on `companies`
- When `company_type = 'security'` → insert into `security_firms`
- When `company_type = 'factory'` → insert into `merch_factories`  
- When `company_type = 'logistics'` → insert into `logistics_companies`

**Alternatively (Code-based)**: Modify `useCreateCompany` in `src/hooks/useCompanies.ts`:
```tsx
onSuccess: async (data) => {
  // Create the subsidiary entity based on type
  if (data.company_type === 'security') {
    await supabase.from('security_firms').insert({
      company_id: data.id,
      name: data.name + ' Security Division'
    });
  } else if (data.company_type === 'factory') {
    await supabase.from('merch_factories').insert({
      company_id: data.id,
      name: data.name + ' Manufacturing',
      city_id: data.headquarters_city_id
    });
  } else if (data.company_type === 'logistics') {
    await supabase.from('logistics_companies').insert({
      company_id: data.id,
      name: data.name + ' Logistics'
    });
  }
}
```

### Phase 2: Creation Costs & Initial Capital

**Add creation costs by company type**:

| Company Type | Creation Cost | Starting Balance |
|--------------|---------------|------------------|
| Holding Company | $100,000 | $500,000 |
| Record Label | $75,000 | $250,000 |
| Security Firm | $50,000 | $100,000 |
| Merch Factory | $150,000 | $200,000 |
| Logistics Company | $100,000 | $150,000 |
| Venue | $200,000 | $300,000 |
| Rehearsal Studio | $75,000 | $100,000 |

**Files to modify**:
- `src/types/company.ts` - Add `COMPANY_CREATION_COSTS` constant
- `src/hooks/useCompanies.ts` - Deduct from player cash, set initial balance
- `src/components/company/CreateCompanyDialog.tsx` - Show cost, validate player has funds

### Phase 3: Fund Management (Deposit/Withdraw)

**Create new component**: `src/components/company/CompanyFinanceDialog.tsx`

Pattern follows `LabelFinanceDialog.tsx`:
- Deposit: Transfer from personal cash → company balance
- Withdraw: Transfer from company balance → personal cash (minimum balance requirement)
- Transaction logging to `company_transactions`

**Add to CompanyDetail.tsx finances tab**:
- Current balance display
- Deposit/withdraw forms
- Recent transactions list
- Projected costs breakdown

### Phase 4: Monthly Tax System

**Create database table**: `company_tax_records`
```sql
CREATE TABLE company_tax_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  tax_period TEXT NOT NULL, -- 'YYYY-MM' format
  gross_revenue NUMERIC DEFAULT 0,
  deductible_expenses NUMERIC DEFAULT 0,
  taxable_income NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0.15, -- 15% default corporate tax
  tax_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, paid, overdue
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Create edge function**: `supabase/functions/process-company-taxes/index.ts`
- Run monthly (1st of each month)
- Calculate taxable income from transactions
- Apply progressive tax rate based on profit
- Create tax record with due date (7 days)
- Auto-deduct if `auto_pay_taxes` is enabled in settings
- Send overdue notifications

**Tax Rate Structure**:
| Monthly Profit | Tax Rate |
|----------------|----------|
| $0 - $10,000 | 10% |
| $10,001 - $50,000 | 15% |
| $50,001 - $100,000 | 20% |
| $100,001+ | 25% |

### Phase 5: Enhanced Navigation

**Update CompanyCard.tsx**: Smart navigation based on company type
```tsx
const getManageRoute = (company: Company) => {
  switch (company.company_type) {
    case 'security':
      return `/security-firm/${company.id}`;
    case 'factory':
      return `/merch-factory/${company.id}`;
    case 'logistics':
      return `/logistics-company/${company.id}`;
    case 'venue':
      return `/venue-business/${company.id}`;
    case 'rehearsal':
      return `/rehearsal-studio-business/${company.id}`;
    default:
      return `/company/${company.id}`;
  }
};
```

**Fix subsidiary management pages** to look up by `company_id` not direct ID:
- `SecurityFirmManagement.tsx` - Uses companyId correctly
- `MerchFactoryManagement.tsx` - Uses factoryId (needs fix)
- `LogisticsCompanyManagement.tsx` - Uses companyId correctly

### Phase 6: UI Enhancements

**CompanyDetail.tsx Finances Tab**:
- Replace placeholder with actual finance management
- Add CompanyFinanceDialog for deposits/withdrawals
- Show tax obligations and payment history
- Display weekly/monthly cost projections

**CreateCompanyDialog.tsx**:
- Show creation cost prominently
- Show player's available cash
- Disable creation if insufficient funds
- Add initial capital preview

---

## Technical Implementation

### Database Changes

**Migration: Create tax table and add company settings columns**
```sql
-- Tax records table
CREATE TABLE IF NOT EXISTS company_tax_records (...);

-- Add auto_pay_taxes to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS auto_pay_taxes BOOLEAN DEFAULT true;

-- Create trigger for subsidiary entity creation
CREATE OR REPLACE FUNCTION create_subsidiary_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_type = 'security' THEN
    INSERT INTO security_firms (company_id, name)
    VALUES (NEW.id, NEW.name || ' Security');
  ELSIF NEW.company_type = 'factory' THEN
    INSERT INTO merch_factories (company_id, name, city_id)
    VALUES (NEW.id, NEW.name || ' Manufacturing', NEW.headquarters_city_id);
  ELSIF NEW.company_type = 'logistics' THEN
    INSERT INTO logistics_companies (company_id, name)
    VALUES (NEW.id, NEW.name || ' Logistics');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_company_insert
AFTER INSERT ON companies
FOR EACH ROW
EXECUTE FUNCTION create_subsidiary_entity();
```

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/company/CompanyFinanceDialog.tsx` | Deposit/withdraw funds |
| `src/components/company/CompanyTaxOverview.tsx` | Tax obligations display |
| `src/hooks/useCompanyFinance.ts` | Finance operations hooks |
| `supabase/functions/process-company-taxes/index.ts` | Monthly tax processing |

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/company.ts` | Add `COMPANY_CREATION_COSTS`, tax types |
| `src/hooks/useCompanies.ts` | Add creation cost logic, initial balance |
| `src/components/company/CreateCompanyDialog.tsx` | Show costs, validate funds |
| `src/components/company/CompanyCard.tsx` | Smart navigation by type |
| `src/pages/CompanyDetail.tsx` | Real finances tab with operations |
| `src/pages/MerchFactoryManagement.tsx` | Fix to use company_id lookup |
| `src/components/VersionHeader.tsx` | Update to v1.0.501 |
| `src/pages/VersionHistory.tsx` | Add changelog |

---

## Version History Entry

**v1.0.501**
- Companies: Creating subsidiaries now automatically creates the actual business entity (security firm, factory, logistics)
- Companies: Added creation costs and initial starting capital by company type
- Companies: Added deposit/withdraw funds functionality for company owners
- Companies: Introduced monthly tax billing system with progressive rates
- Companies: Smart navigation - "Manage" now goes to the correct specialized management page
- Companies: Fixed merch factory management to properly lookup by company_id
- UI: Enhanced finances tab with real fund management and tax overview
