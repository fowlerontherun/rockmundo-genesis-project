import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tax rates by company type — corporate income tax
const CORPORATE_TAX_RATES: Record<string, number> = {
  holding: 0.25,     // 25% — holding companies taxed higher
  label: 0.22,       // 22% — entertainment industry rate
  security: 0.20,    // 20% — service industry
  factory: 0.18,     // 18% — manufacturing benefits
  logistics: 0.20,   // 20% — transport industry
  venue: 0.22,       // 22% — entertainment venues
  rehearsal: 0.15,   // 15% — small business rate
  recording_studio: 0.18, // 18% — creative industry incentive
};

// Simulated daily revenue ranges by subsidiary type
const DAILY_REVENUE_RANGES: Record<string, { min: number; max: number }> = {
  security: { min: 200, max: 800 },
  factory: { min: 500, max: 2000 },
  logistics: { min: 300, max: 1200 },
  venue: { min: 400, max: 3000 },
  rehearsal: { min: 100, max: 600 },
  recording_studio: { min: 300, max: 1500 },
};

function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[process-company-operations] Starting operations processing...');

  try {
    // Get all active companies
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .eq('status', 'active');

    if (companiesError) throw companiesError;

    console.log(`[process-company-operations] Found ${companies?.length || 0} active companies`);

    let processedCount = 0;
    let totalCosts = 0;
    let totalRevenue = 0;
    let totalTaxes = 0;

    // ==========================================
    // PHASE 1: Operating Costs (daily from weekly)
    // ==========================================
    for (const company of companies || []) {
      const dailyOperatingCost = (company.weekly_operating_costs || 0) / 7;
      
      if (dailyOperatingCost > 0) {
        const newBalance = (company.balance || 0) - dailyOperatingCost;
        
        await supabase
          .from('companies')
          .update({ 
            balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', company.id);

        await supabase
          .from('company_transactions')
          .insert({
            company_id: company.id,
            transaction_type: 'expense',
            amount: -dailyOperatingCost,
            description: 'Daily operating costs (rent, utilities, insurance)',
            category: 'operations'
          });

        processedCount++;
        totalCosts += dailyOperatingCost;
      }
    }

    // ==========================================
    // PHASE 2: Employee Salary Processing
    // ==========================================
    const { data: employees } = await supabase
      .from('company_employees')
      .select('id, company_id, salary, role, status')
      .eq('status', 'active');

    for (const employee of employees || []) {
      // Daily salary = monthly / 30
      const dailySalary = (employee.salary || 0) / 30;
      if (dailySalary <= 0) continue;

      const { data: company } = await supabase
        .from('companies')
        .select('balance, status')
        .eq('id', employee.company_id)
        .single();

      if (!company || company.status !== 'active') continue;

      const newBalance = (company.balance || 0) - dailySalary;

      await supabase
        .from('companies')
        .update({ balance: newBalance })
        .eq('id', employee.company_id);

      await supabase
        .from('company_transactions')
        .insert({
          company_id: employee.company_id,
          transaction_type: 'salary',
          amount: -dailySalary,
          description: `Employee salary: ${employee.role}`,
          category: 'payroll'
        });

      totalCosts += dailySalary;
    }

    // ==========================================
    // PHASE 3: Revenue Generation from Subsidiaries
    // ==========================================
    // Security Firms revenue (from gig bookings)
    const { data: securityFirms } = await supabase
      .from('security_firms')
      .select('id, name, company_id, tier, operating_costs')
      .not('company_id', 'is', null);

    for (const firm of securityFirms || []) {
      const range = DAILY_REVENUE_RANGES.security;
      const tierMultiplier = 1 + ((firm.tier || 1) - 1) * 0.3;
      const dailyRevenue = randomBetween(range.min, range.max) * tierMultiplier;
      const dailyCost = (firm.operating_costs || 100) / 7;

      // Apply revenue
      const { data: company } = await supabase
        .from('companies')
        .select('balance')
        .eq('id', firm.company_id)
        .single();

      if (!company) continue;

      const netChange = dailyRevenue - dailyCost;
      await supabase
        .from('companies')
        .update({ balance: (company.balance || 0) + netChange })
        .eq('id', firm.company_id);

      // Revenue transaction
      if (dailyRevenue > 0) {
        await supabase.from('company_transactions').insert({
          company_id: firm.company_id,
          transaction_type: 'income',
          amount: dailyRevenue,
          description: `Security Firm "${firm.name}" service revenue`,
          category: 'subsidiary_revenue'
        });
        totalRevenue += dailyRevenue;
      }

      // Expense transaction
      if (dailyCost > 0) {
        await supabase.from('company_transactions').insert({
          company_id: firm.company_id,
          transaction_type: 'expense',
          amount: -dailyCost,
          description: `Security Firm "${firm.name}" operating costs`,
          category: 'subsidiary_operations'
        });
        totalCosts += dailyCost;
      }
    }

    // Merch Factories revenue
    const { data: factories } = await supabase
      .from('merch_factories')
      .select('id, name, company_id, quality_tier, monthly_overhead')
      .not('company_id', 'is', null);

    for (const factory of factories || []) {
      const range = DAILY_REVENUE_RANGES.factory;
      const tierMultiplier = 1 + ((factory.quality_tier || 1) - 1) * 0.25;
      const dailyRevenue = randomBetween(range.min, range.max) * tierMultiplier;
      const dailyCost = (factory.monthly_overhead || 5000) / 30;

      const { data: company } = await supabase
        .from('companies')
        .select('balance')
        .eq('id', factory.company_id)
        .single();

      if (!company) continue;

      const netChange = dailyRevenue - dailyCost;
      await supabase.from('companies')
        .update({ balance: (company.balance || 0) + netChange })
        .eq('id', factory.company_id);

      if (dailyRevenue > 0) {
        await supabase.from('company_transactions').insert({
          company_id: factory.company_id,
          transaction_type: 'income',
          amount: dailyRevenue,
          description: `Factory "${factory.name}" manufacturing revenue`,
          category: 'subsidiary_revenue'
        });
        totalRevenue += dailyRevenue;
      }

      if (dailyCost > 0) {
        await supabase.from('company_transactions').insert({
          company_id: factory.company_id,
          transaction_type: 'expense',
          amount: -dailyCost,
          description: `Factory "${factory.name}" operating costs`,
          category: 'subsidiary_operations'
        });
        totalCosts += dailyCost;
      }
    }

    // Logistics Companies revenue
    const { data: logisticsCompanies } = await supabase
      .from('logistics_companies')
      .select('id, name, company_id, tier, weekly_operating_costs')
      .not('company_id', 'is', null);

    for (const lc of logisticsCompanies || []) {
      const range = DAILY_REVENUE_RANGES.logistics;
      const tierMultiplier = 1 + ((lc.tier || 1) - 1) * 0.3;
      const dailyRevenue = randomBetween(range.min, range.max) * tierMultiplier;
      const dailyCost = (lc.weekly_operating_costs || 500) / 7;

      const { data: company } = await supabase
        .from('companies')
        .select('balance')
        .eq('id', lc.company_id)
        .single();

      if (!company) continue;

      const netChange = dailyRevenue - dailyCost;
      await supabase.from('companies')
        .update({ balance: (company.balance || 0) + netChange })
        .eq('id', lc.company_id);

      if (dailyRevenue > 0) {
        await supabase.from('company_transactions').insert({
          company_id: lc.company_id,
          transaction_type: 'income',
          amount: dailyRevenue,
          description: `Logistics "${lc.name}" transport revenue`,
          category: 'subsidiary_revenue'
        });
        totalRevenue += dailyRevenue;
      }

      if (dailyCost > 0) {
        await supabase.from('company_transactions').insert({
          company_id: lc.company_id,
          transaction_type: 'expense',
          amount: -dailyCost,
          description: `Logistics "${lc.name}" operating costs`,
          category: 'subsidiary_operations'
        });
        totalCosts += dailyCost;
      }
    }

    // Venues revenue (ticket cuts, bar sales, private events)
    const { data: venues } = await supabase
      .from('venues')
      .select('id, name, company_id, capacity, venue_cut')
      .not('company_id', 'is', null);

    for (const venue of venues || []) {
      const range = DAILY_REVENUE_RANGES.venue;
      const capacityMultiplier = Math.min(3, (venue.capacity || 200) / 200);
      const dailyRevenue = randomBetween(range.min, range.max) * capacityMultiplier;

      const { data: company } = await supabase
        .from('companies')
        .select('balance')
        .eq('id', venue.company_id)
        .single();

      if (!company) continue;

      await supabase.from('companies')
        .update({ balance: (company.balance || 0) + dailyRevenue })
        .eq('id', venue.company_id);

      await supabase.from('company_transactions').insert({
        company_id: venue.company_id,
        transaction_type: 'income',
        amount: dailyRevenue,
        description: `Venue "${venue.name}" ticket & bar revenue`,
        category: 'subsidiary_revenue'
      });
      totalRevenue += dailyRevenue;
    }

    // Rehearsal Studios revenue
    const { data: rehearsalStudios } = await supabase
      .from('rehearsal_rooms')
      .select('id, name, company_id, hourly_rate')
      .not('company_id', 'is', null);

    for (const studio of rehearsalStudios || []) {
      const range = DAILY_REVENUE_RANGES.rehearsal;
      const rateMultiplier = Math.max(1, (studio.hourly_rate || 20) / 20);
      const dailyRevenue = randomBetween(range.min, range.max) * rateMultiplier;

      const { data: company } = await supabase
        .from('companies')
        .select('balance')
        .eq('id', studio.company_id)
        .single();

      if (!company) continue;

      await supabase.from('companies')
        .update({ balance: (company.balance || 0) + dailyRevenue })
        .eq('id', studio.company_id);

      await supabase.from('company_transactions').insert({
        company_id: studio.company_id,
        transaction_type: 'income',
        amount: dailyRevenue,
        description: `Rehearsal "${studio.name}" booking revenue`,
        category: 'subsidiary_revenue'
      });
      totalRevenue += dailyRevenue;
    }

    // Recording Studios revenue
    const { data: recordingStudios } = await supabase
      .from('city_studios')
      .select('id, name, company_id, hourly_rate, quality_rating')
      .not('company_id', 'is', null);

    for (const studio of recordingStudios || []) {
      const range = DAILY_REVENUE_RANGES.recording_studio;
      const qualityMultiplier = Math.max(1, (studio.quality_rating || 50) / 50);
      const dailyRevenue = randomBetween(range.min, range.max) * qualityMultiplier;

      const { data: company } = await supabase
        .from('companies')
        .select('balance')
        .eq('id', studio.company_id)
        .single();

      if (!company) continue;

      await supabase.from('companies')
        .update({ balance: (company.balance || 0) + dailyRevenue })
        .eq('id', studio.company_id);

      await supabase.from('company_transactions').insert({
        company_id: studio.company_id,
        transaction_type: 'income',
        amount: dailyRevenue,
        description: `Recording Studio "${studio.name}" session revenue`,
        category: 'subsidiary_revenue'
      });
      totalRevenue += dailyRevenue;
    }

    // ==========================================
    // PHASE 4: Monthly Tax Generation (on 1st of month)
    // ==========================================
    const today = new Date();
    const isFirstOfMonth = today.getDate() === 1;

    if (isFirstOfMonth) {
      console.log('[process-company-operations] First of month — generating tax records...');
      
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const taxPeriod = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
      const dueDate = new Date(today.getFullYear(), today.getMonth(), 15); // Due 15th

      for (const company of companies || []) {
        // Check if tax already generated for this period
        const { data: existingTax } = await supabase
          .from('company_tax_records')
          .select('id')
          .eq('company_id', company.id)
          .eq('tax_period', taxPeriod)
          .maybeSingle();

        if (existingTax) continue;

        // Calculate last month's revenue and expenses from transactions
        const monthStart = lastMonth.toISOString();
        const monthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString();

        const { data: monthTxns } = await supabase
          .from('company_transactions')
          .select('transaction_type, amount')
          .eq('company_id', company.id)
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd);

        const grossRevenue = (monthTxns || [])
          .filter(t => t.amount > 0)
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const deductibleExpenses = Math.abs(
          (monthTxns || [])
            .filter(t => t.amount < 0)
            .reduce((sum, t) => sum + Number(t.amount), 0)
        );

        const taxableIncome = Math.max(0, grossRevenue - deductibleExpenses);
        const taxRate = CORPORATE_TAX_RATES[company.company_type] || 0.20;
        const taxAmount = Math.round(taxableIncome * taxRate * 100) / 100;

        if (taxAmount > 0) {
          await supabase.from('company_tax_records').insert({
            company_id: company.id,
            tax_period: taxPeriod,
            gross_revenue: grossRevenue,
            deductible_expenses: deductibleExpenses,
            taxable_income: taxableIncome,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            tax_type: 'corporate',
            status: 'pending',
            due_date: dueDate.toISOString(),
          });

          totalTaxes += taxAmount;
          console.log(`[process-company-operations] Tax for ${company.name}: $${taxAmount.toFixed(2)} (${(taxRate * 100).toFixed(0)}%)`);
        }
      }

      // Check for overdue taxes and apply penalties
      const { data: overdueTaxes } = await supabase
        .from('company_tax_records')
        .select('id, company_id, tax_amount, penalty_amount')
        .eq('status', 'pending')
        .lt('due_date', today.toISOString());

      for (const tax of overdueTaxes || []) {
        const penalty = Math.round(Number(tax.tax_amount) * 0.05 * 100) / 100; // 5% late fee
        await supabase
          .from('company_tax_records')
          .update({ 
            status: 'overdue',
            penalty_amount: (Number(tax.penalty_amount) || 0) + penalty
          })
          .eq('id', tax.id);
      }
    }

    // ==========================================
    // PHASE 5: Auto-pay taxes if enabled
    // ==========================================
    const { data: autoPaySettings } = await supabase
      .from('company_settings')
      .select('company_id')
      .eq('auto_pay_taxes', true);

    const autoPayCompanyIds = (autoPaySettings || []).map(s => s.company_id);

    if (autoPayCompanyIds.length > 0) {
      const { data: pendingTaxes } = await supabase
        .from('company_tax_records')
        .select('*')
        .in('company_id', autoPayCompanyIds)
        .in('status', ['pending', 'overdue']);

      for (const tax of pendingTaxes || []) {
        const totalDue = Number(tax.tax_amount) + (Number(tax.penalty_amount) || 0);

        const { data: company } = await supabase
          .from('companies')
          .select('balance')
          .eq('id', tax.company_id)
          .single();

        if (!company || Number(company.balance) < totalDue) continue;

        // Pay the tax
        await supabase.from('companies')
          .update({ balance: Number(company.balance) - totalDue })
          .eq('id', tax.company_id);

        await supabase.from('company_tax_records')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', tax.id);

        await supabase.from('company_transactions').insert({
          company_id: tax.company_id,
          transaction_type: 'expense',
          amount: -totalDue,
          description: `Corporate tax payment (${tax.tax_period})${Number(tax.penalty_amount) > 0 ? ` + $${Number(tax.penalty_amount).toFixed(0)} penalty` : ''}`,
          category: 'tax'
        });
      }
    }

    // ==========================================
    // PHASE 6: Bankruptcy Check
    // ==========================================
    // Refresh company balances after all operations
    const { data: updatedCompanies } = await supabase
      .from('companies')
      .select('id, balance, negative_balance_since, is_bankrupt')
      .eq('status', 'active');

    for (const company of updatedCompanies || []) {
      const balance = Number(company.balance);
      
      if (balance < 0 && !company.negative_balance_since) {
        await supabase.from('companies')
          .update({ negative_balance_since: new Date().toISOString() })
          .eq('id', company.id);
      } else if (balance >= 0 && company.negative_balance_since) {
        await supabase.from('companies')
          .update({ negative_balance_since: null, is_bankrupt: false })
          .eq('id', company.id);
      }

      // Check for bankruptcy (negative for 7+ days)
      if (company.negative_balance_since && !company.is_bankrupt) {
        const daysSinceNegative = Math.floor(
          (Date.now() - new Date(company.negative_balance_since).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceNegative >= 7) {
          await supabase.from('companies')
            .update({ 
              is_bankrupt: true, 
              status: 'bankrupt',
              bankruptcy_date: new Date().toISOString()
            })
            .eq('id', company.id);
          console.log(`[process-company-operations] Company ${company.id} declared BANKRUPT`);
        }
      }
    }

    console.log(`[process-company-operations] Complete: ${processedCount} companies, Revenue: $${totalRevenue.toFixed(2)}, Costs: $${totalCosts.toFixed(2)}, Taxes: $${totalTaxes.toFixed(2)}`);

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      totalRevenue,
      totalCosts,
      totalTaxes
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[process-company-operations] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
