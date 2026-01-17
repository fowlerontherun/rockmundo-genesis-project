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

  console.log('[process-logistics-contracts] Starting contract processing...');

  try {
    const now = new Date();
    let processedCount = 0;
    let totalRevenue = 0;
    let completedContracts = 0;

    // Get active contracts that should be completed
    const { data: contracts } = await supabase
      .from('logistics_contracts')
      .select(`
        id,
        logistics_company_id,
        contract_value,
        status,
        end_date,
        logistics_companies!inner(
          id,
          name,
          company_id
        )
      `)
      .eq('status', 'active')
      .lte('end_date', now.toISOString());

    console.log(`[process-logistics-contracts] Found ${contracts?.length || 0} contracts to process`);

    for (const contract of contracts || []) {
      const logisticsCompany = contract.logistics_companies as any;
      if (!logisticsCompany?.company_id) continue;

      // Check if already processed
      const { data: existingTx } = await supabase
        .from('company_transactions')
        .select('id')
        .eq('metadata->contract_id', contract.id)
        .eq('category', 'logistics_contract_completion')
        .single();

      if (existingTx) continue;

      const contractValue = contract.contract_value || 0;
      
      // Mark contract as completed
      await supabase
        .from('logistics_contracts')
        .update({ status: 'completed' })
        .eq('id', contract.id);

      if (contractValue > 0) {
        // Credit parent company
        const { data: company } = await supabase
          .from('companies')
          .select('balance')
          .eq('id', logisticsCompany.company_id)
          .single();

        const newBalance = (company?.balance || 0) + contractValue;

        await supabase
          .from('companies')
          .update({ 
            balance: newBalance,
            updated_at: now.toISOString()
          })
          .eq('id', logisticsCompany.company_id);

        // Record transaction
        await supabase
          .from('company_transactions')
          .insert({
            company_id: logisticsCompany.company_id,
            transaction_type: 'income',
            amount: contractValue,
            description: `Logistics contract completed (${logisticsCompany.name})`,
            category: 'logistics_contract_completion',
            metadata: { contract_id: contract.id }
          });

        // Update logistics company stats
        await supabase
          .from('logistics_companies')
          .update({
            total_revenue: supabase.sql`total_revenue + ${contractValue}`,
            contracts_completed: supabase.sql`contracts_completed + 1`
          })
          .eq('id', logisticsCompany.id);

        totalRevenue += contractValue;

        console.log(`[process-logistics-contracts] Completed contract ${contract.id}: $${contractValue.toFixed(2)}`);
      }

      completedContracts++;
      processedCount++;
    }

    // Process in-progress contracts - calculate partial payments for long contracts
    const { data: activeContracts } = await supabase
      .from('logistics_contracts')
      .select(`
        id,
        logistics_company_id,
        contract_value,
        start_date,
        end_date,
        status,
        logistics_companies!inner(
          id,
          name,
          company_id
        )
      `)
      .eq('status', 'active')
      .gt('end_date', now.toISOString());

    // For weekly contracts, pay out partial amounts
    for (const contract of activeContracts || []) {
      const logisticsCompany = contract.logistics_companies as any;
      if (!logisticsCompany?.company_id) continue;

      const startDate = new Date(contract.start_date);
      const endDate = new Date(contract.end_date);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (totalDays <= 1) continue; // Skip short contracts
      
      const dailyValue = (contract.contract_value || 0) / totalDays;
      
      // Check if we've already paid today
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      
      const { data: todayTx } = await supabase
        .from('company_transactions')
        .select('id')
        .eq('metadata->contract_id', contract.id)
        .eq('category', 'logistics_daily_payment')
        .gte('created_at', todayStart.toISOString())
        .single();

      if (todayTx) continue;

      if (dailyValue > 0) {
        const { data: company } = await supabase
          .from('companies')
          .select('balance')
          .eq('id', logisticsCompany.company_id)
          .single();

        const newBalance = (company?.balance || 0) + dailyValue;

        await supabase
          .from('companies')
          .update({ balance: newBalance })
          .eq('id', logisticsCompany.company_id);

        await supabase
          .from('company_transactions')
          .insert({
            company_id: logisticsCompany.company_id,
            transaction_type: 'income',
            amount: dailyValue,
            description: `Daily contract payment (${logisticsCompany.name})`,
            category: 'logistics_daily_payment',
            metadata: { contract_id: contract.id }
          });

        totalRevenue += dailyValue;
        processedCount++;
      }
    }

    // Free up drivers and vehicles from completed contracts
    await supabase
      .from('logistics_drivers')
      .update({ current_contract_id: null, status: 'available' })
      .in('current_contract_id', (contracts || []).map(c => c.id));

    await supabase
      .from('logistics_fleet')
      .update({ current_contract_id: null, status: 'available' })
      .in('current_contract_id', (contracts || []).map(c => c.id));

    console.log(`[process-logistics-contracts] Complete: ${processedCount} processed, ${completedContracts} completed, $${totalRevenue.toFixed(2)} revenue`);

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      completedContracts,
      totalRevenue
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[process-logistics-contracts] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
