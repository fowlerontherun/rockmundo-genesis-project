import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tax rates by company type — corporate income tax
const CORPORATE_TAX_RATES: Record<string, number> = {
  holding: 0.25,
  label: 0.22,
  security: 0.20,
  factory: 0.18,
  logistics: 0.20,
  venue: 0.22,
  rehearsal: 0.15,
  recording_studio: 0.18,
};

// Base daily activity revenue caps - actual revenue is derived from game activity
const BASE_ACTIVITY_REVENUE: Record<string, number> = {
  security: 100,   // Base from reputation alone
  factory: 150,
  logistics: 100,
  venue: 200,
  rehearsal: 50,
  recording_studio: 100,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[process-company-operations] Starting operations processing...');

  try {
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

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // ==========================================
    // PRE-FETCH: Active synergies for discount application
    // ==========================================
    const { data: allSynergies } = await supabase
      .from('company_synergies')
      .select('company_id, synergy_type, discount_percentage, is_active')
      .eq('is_active', true);

    // Build a map: company_id -> total synergy discount %
    const synergyDiscountMap = new Map<string, number>();
    for (const synergy of allSynergies || []) {
      const current = synergyDiscountMap.get(synergy.company_id) || 0;
      synergyDiscountMap.set(synergy.company_id, Math.min(35, current + (synergy.discount_percentage || 0))); // cap at 35%
    }
    console.log(`[process-company-operations] Loaded ${allSynergies?.length || 0} active synergies for ${synergyDiscountMap.size} companies`);

    // ==========================================
    // PHASE 1: Operating Costs (daily from weekly) — with synergy discount
    // ==========================================
    for (const company of companies || []) {
      const baseDailyCost = (company.weekly_operating_costs || 0) / 7;
      const synergyDiscount = synergyDiscountMap.get(company.id) || 0;
      const dailyOperatingCost = Math.round(baseDailyCost * (1 - synergyDiscount / 100));
      
      if (dailyOperatingCost > 0) {
        const newBalance = (company.balance || 0) - dailyOperatingCost;
        
        await supabase
          .from('companies')
          .update({ balance: newBalance, updated_at: now.toISOString() })
          .eq('id', company.id);

        await supabase.from('company_transactions').insert({
          company_id: company.id,
          transaction_type: 'expense',
          amount: -dailyOperatingCost,
          description: `Daily operating costs${synergyDiscount > 0 ? ` (${synergyDiscount}% synergy discount applied)` : ''}`,
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
      const dailySalary = (employee.salary || 0) / 30;
      if (dailySalary <= 0) continue;

      const { data: company } = await supabase
        .from('companies')
        .select('balance, status')
        .eq('id', employee.company_id)
        .single();

      if (!company || company.status !== 'active') continue;

      await supabase.from('companies')
        .update({ balance: (company.balance || 0) - dailySalary })
        .eq('id', employee.company_id);

      await supabase.from('company_transactions').insert({
        company_id: employee.company_id,
        transaction_type: 'salary',
        amount: -dailySalary,
        description: `Employee salary: ${employee.role}`,
        category: 'payroll'
      });

      totalCosts += dailySalary;
    }

    // ==========================================
    // PHASE 3: Activity-Based Revenue from Subsidiaries
    // ==========================================

    // --- SECURITY FIRMS: Revenue from recent gigs in their city/region ---
    const { data: securityFirms } = await supabase
      .from('security_firms')
      .select('id, name, company_id, tier, operating_costs, city_id')
      .not('company_id', 'is', null);

    for (const firm of securityFirms || []) {
      const tierMultiplier = 1 + ((firm.tier || 1) - 1) * 0.4;
      const baseDailyCost = (firm.operating_costs || 100) / 7;
      const firmSynergyDiscount = synergyDiscountMap.get(firm.company_id!) || 0;
      const dailyCost = Math.round(baseDailyCost * (1 - firmSynergyDiscount / 100));

      // Count recent gigs in any city — security firms provide event security services
      const { count: recentGigCount } = await supabase
        .from('gigs')
        .select('*', { count: 'exact', head: true })
        .gte('performance_date', sevenDaysAgo)
        .in('status', ['completed', 'performing']);

      // Revenue = base + per-gig service fee (security firms serve as event security providers)
      const gigsServed = Math.min(recentGigCount || 0, 10 * (firm.tier || 1)); // capacity based on tier
      const perGigFee = 150 * tierMultiplier;
      const dailyRevenue = Math.round((BASE_ACTIVITY_REVENUE.security * tierMultiplier) + (gigsServed * perGigFee / 7));

      const { data: company } = await supabase
        .from('companies')
        .select('balance')
        .eq('id', firm.company_id)
        .single();

      if (!company) continue;

      const netChange = dailyRevenue - dailyCost;
      await supabase.from('companies')
        .update({ balance: (company.balance || 0) + netChange })
        .eq('id', firm.company_id);

      if (dailyRevenue > 0) {
        await supabase.from('company_transactions').insert({
          company_id: firm.company_id,
          transaction_type: 'income',
          amount: dailyRevenue,
          description: `Security Firm "${firm.name}" — ${gigsServed} events serviced this week`,
          category: 'subsidiary_revenue'
        });
        totalRevenue += dailyRevenue;
      }

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

    // --- MERCH FACTORIES: Revenue from recent merch orders ---
    const { data: factories } = await supabase
      .from('merch_factories')
      .select('id, name, company_id, quality_tier, monthly_overhead')
      .not('company_id', 'is', null);

    for (const factory of factories || []) {
      const tierMultiplier = 1 + ((factory.quality_tier || 1) - 1) * 0.3;
      const baseFactoryCost = (factory.monthly_overhead || 5000) / 30;
      const factorySynergyDiscount = synergyDiscountMap.get(factory.company_id!) || 0;
      const dailyCost = Math.round(baseFactoryCost * (1 - factorySynergyDiscount / 100));

      // Count recent merch orders as manufacturing activity
      const { count: recentMerchOrders } = await supabase
        .from('merch_orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo);

      // Factory revenue = base manufacturing fee + per-order processing fee
      const ordersProcessed = Math.min(recentMerchOrders || 0, 50 * (factory.quality_tier || 1));
      const perOrderFee = 25 * tierMultiplier;
      const dailyRevenue = Math.round((BASE_ACTIVITY_REVENUE.factory * tierMultiplier) + (ordersProcessed * perOrderFee / 7));

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
          description: `Factory "${factory.name}" — ${ordersProcessed} merch orders manufactured this week`,
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

    // --- LOGISTICS: Revenue from recent tours/travel ---
    const { data: logisticsCompanies } = await supabase
      .from('logistics_companies')
      .select('id, name, company_id, tier, weekly_operating_costs')
      .not('company_id', 'is', null);

    for (const lc of logisticsCompanies || []) {
      const tierMultiplier = 1 + ((lc.tier || 1) - 1) * 0.35;
      const dailyCost = (lc.weekly_operating_costs || 500) / 7;

      // Count recent band travel activities
      const { count: recentTravels } = await supabase
        .from('band_travel')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo);

      // Also count recent release distribution territories
      const { count: recentDistributions } = await supabase
        .from('release_territories')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo);

      const transportJobs = Math.min((recentTravels || 0) + (recentDistributions || 0), 20 * (lc.tier || 1));
      const perJobFee = 200 * tierMultiplier;
      const dailyRevenue = Math.round((BASE_ACTIVITY_REVENUE.logistics * tierMultiplier) + (transportJobs * perJobFee / 7));

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
          description: `Logistics "${lc.name}" — ${transportJobs} transport/distribution jobs this week`,
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

    // --- VENUES: Revenue from actual gig bookings ---
    const { data: venues } = await supabase
      .from('venues')
      .select('id, name, company_id, capacity, venue_cut')
      .not('company_id', 'is', null);

    for (const venue of venues || []) {
      // Count actual gigs at this venue in the last 7 days
      const { data: recentVenueGigs } = await supabase
        .from('gigs')
        .select('ticket_price, actual_attendance')
        .eq('venue_id', venue.id)
        .eq('status', 'completed')
        .gte('performance_date', sevenDaysAgo);

      // Calculate actual venue revenue from gigs
      let gigRevenue = 0;
      for (const gig of recentVenueGigs || []) {
        const ticketRevenue = (gig.ticket_price || 10) * (gig.actual_attendance || 0);
        gigRevenue += ticketRevenue * ((venue.venue_cut || 20) / 100);
      }

      // Add bar/concession revenue (proportional to attendance)
      const totalAttendance = (recentVenueGigs || []).reduce((sum, g) => sum + (g.actual_attendance || 0), 0);
      const barRevenue = totalAttendance * 3; // ~$3 per attendee in bar sales

      const dailyRevenue = Math.round((gigRevenue + barRevenue) / 7 + BASE_ACTIVITY_REVENUE.venue);

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
        description: `Venue "${venue.name}" — ${recentVenueGigs?.length || 0} gigs, ${totalAttendance} attendees this week`,
        category: 'subsidiary_revenue'
      });
      totalRevenue += dailyRevenue;
    }

    // --- REHEARSAL STUDIOS: Revenue from actual rehearsal bookings ---
    const { data: rehearsalStudios } = await supabase
      .from('rehearsal_rooms')
      .select('id, name, company_id, hourly_rate')
      .not('company_id', 'is', null);

    for (const studio of rehearsalStudios || []) {
      // Count recent rehearsal completions
      const { count: recentRehearsals } = await supabase
        .from('band_rehearsals')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', studio.id)
        .gte('created_at', sevenDaysAgo);

      const hoursBooked = (recentRehearsals || 0) * 2; // ~2 hours per rehearsal
      const sessionRevenue = hoursBooked * (studio.hourly_rate || 20);
      const dailyRevenue = Math.round(sessionRevenue / 7 + BASE_ACTIVITY_REVENUE.rehearsal);

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
        description: `Rehearsal "${studio.name}" — ${recentRehearsals || 0} sessions this week`,
        category: 'subsidiary_revenue'
      });
      totalRevenue += dailyRevenue;
    }

    // --- RECORDING STUDIOS: Revenue from actual recording sessions ---
    const { data: recordingStudios } = await supabase
      .from('city_studios')
      .select('id, name, company_id, hourly_rate, quality_rating')
      .not('company_id', 'is', null);

    for (const studio of recordingStudios || []) {
      // Count recent recording sessions at this studio
      const { count: recentSessions } = await supabase
        .from('recording_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('studio_id', studio.id)
        .gte('created_at', sevenDaysAgo);

      const hoursBooked = (recentSessions || 0) * 4; // ~4 hours per session
      const sessionRevenue = hoursBooked * (studio.hourly_rate || 50);
      const qualityBonus = Math.max(1, (studio.quality_rating || 50) / 50);
      const dailyRevenue = Math.round((sessionRevenue * qualityBonus) / 7 + BASE_ACTIVITY_REVENUE.recording_studio);

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
        description: `Recording Studio "${studio.name}" — ${recentSessions || 0} sessions this week`,
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
      const dueDate = new Date(today.getFullYear(), today.getMonth(), 15);

      for (const company of companies || []) {
        const { data: existingTax } = await supabase
          .from('company_tax_records')
          .select('id')
          .eq('company_id', company.id)
          .eq('tax_period', taxPeriod)
          .maybeSingle();

        if (existingTax) continue;

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
        const penalty = Math.round(Number(tax.tax_amount) * 0.05 * 100) / 100;
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
