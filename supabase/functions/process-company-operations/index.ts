import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    // Get all active companies
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .eq('status', 'active');

    if (companiesError) throw companiesError;

    console.log(`[process-company-operations] Found ${companies?.length || 0} active companies`);

    let processedCount = 0;
    let totalCosts = 0;

    for (const company of companies || []) {
      // Calculate daily operating costs (weekly / 7)
      const dailyOperatingCost = (company.weekly_operating_costs || 0) / 7;
      
      if (dailyOperatingCost > 0) {
        const newBalance = (company.balance || 0) - dailyOperatingCost;
        
        // Update balance
        await supabase
          .from('companies')
          .update({ 
            balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', company.id);

        // Record transaction
        await supabase
          .from('company_transactions')
          .insert({
            company_id: company.id,
            transaction_type: 'expense',
            amount: -dailyOperatingCost,
            description: 'Daily operating costs',
            category: 'operations'
          });

        processedCount++;
        totalCosts += dailyOperatingCost;
        
        console.log(`[process-company-operations] ${company.name}: -$${dailyOperatingCost.toFixed(2)}`);
      }
    }

    // Process subsidiary operating costs
    // Security Firms
    const { data: securityFirms } = await supabase
      .from('security_firms')
      .select('*, companies!inner(id, name, balance)')
      .not('company_id', 'is', null);

    for (const firm of securityFirms || []) {
      const dailyCost = (firm.operating_costs || 100) / 7;
      const company = firm.companies as any;
      
      if (dailyCost > 0 && company) {
        const newBalance = (company.balance || 0) - dailyCost;
        
        await supabase
          .from('companies')
          .update({ balance: newBalance })
          .eq('id', company.id);

        await supabase
          .from('company_transactions')
          .insert({
            company_id: company.id,
            transaction_type: 'expense',
            amount: -dailyCost,
            description: `Security Firm "${firm.name}" operating costs`,
            category: 'subsidiary_operations'
          });

        totalCosts += dailyCost;
      }
    }

    // Merch Factories
    const { data: factories } = await supabase
      .from('merch_factories')
      .select('*, companies!inner(id, name, balance)')
      .not('company_id', 'is', null);

    for (const factory of factories || []) {
      const dailyCost = (factory.monthly_overhead || 5000) / 30;
      const company = factory.companies as any;
      
      if (dailyCost > 0 && company) {
        const newBalance = (company.balance || 0) - dailyCost;
        
        await supabase
          .from('companies')
          .update({ balance: newBalance })
          .eq('id', company.id);

        await supabase
          .from('company_transactions')
          .insert({
            company_id: company.id,
            transaction_type: 'expense',
            amount: -dailyCost,
            description: `Factory "${factory.name}" operating costs`,
            category: 'subsidiary_operations'
          });

        totalCosts += dailyCost;
      }
    }

    // Logistics Companies
    const { data: logisticsCompanies } = await supabase
      .from('logistics_companies')
      .select('*, companies!inner(id, name, balance)')
      .not('company_id', 'is', null);

    for (const lc of logisticsCompanies || []) {
      const dailyCost = (lc.weekly_operating_costs || 500) / 7;
      const company = lc.companies as any;
      
      if (dailyCost > 0 && company) {
        const newBalance = (company.balance || 0) - dailyCost;
        
        await supabase
          .from('companies')
          .update({ balance: newBalance })
          .eq('id', company.id);

        await supabase
          .from('company_transactions')
          .insert({
            company_id: company.id,
            transaction_type: 'expense',
            amount: -dailyCost,
            description: `Logistics "${lc.name}" operating costs`,
            category: 'subsidiary_operations'
          });

        totalCosts += dailyCost;
      }
    }

    console.log(`[process-company-operations] Complete: ${processedCount} companies, $${totalCosts.toFixed(2)} total costs`);

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      totalCosts
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
