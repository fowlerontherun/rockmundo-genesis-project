import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BANKRUPTCY_THRESHOLD_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[check-company-bankruptcy] Starting bankruptcy check...');

  try {
    const now = new Date();
    let warningsIssued = 0;
    let bankruptciesDeclared = 0;

    // Get all companies with negative balance
    const { data: companies } = await supabase
      .from('companies')
      .select('*')
      .lt('balance', 0)
      .eq('status', 'active');

    console.log(`[check-company-bankruptcy] Found ${companies?.length || 0} companies with negative balance`);

    for (const company of companies || []) {
      // Check when balance first went negative
      const { data: firstNegativeTx } = await supabase
        .from('company_transactions')
        .select('created_at')
        .eq('company_id', company.id)
        .lt('amount', 0)
        .order('created_at', { ascending: false })
        .limit(50);

      // Calculate days in negative
      let daysNegative = 0;
      let runningBalance = company.balance || 0;
      
      // Simple check: if negative_balance_since exists, use that
      if (company.negative_balance_since) {
        const negativeDate = new Date(company.negative_balance_since);
        daysNegative = Math.floor((now.getTime() - negativeDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        // Mark when it went negative
        await supabase
          .from('companies')
          .update({ negative_balance_since: now.toISOString() })
          .eq('id', company.id);
        daysNegative = 0;
      }

      console.log(`[check-company-bankruptcy] ${company.name}: $${company.balance}, ${daysNegative} days negative`);

      if (daysNegative >= BANKRUPTCY_THRESHOLD_DAYS) {
        // Declare bankruptcy
        await supabase
          .from('companies')
          .update({ 
            status: 'bankrupt',
            updated_at: now.toISOString()
          })
          .eq('id', company.id);

        // Send notification
        await supabase
          .from('company_notifications')
          .insert({
            company_id: company.id,
            notification_type: 'critical',
            title: 'BANKRUPTCY DECLARED',
            message: `${company.name} has been declared bankrupt due to sustained negative balance. All operations are suspended.`,
            priority: 'critical'
          });

        // Suspend all subsidiaries
        // Security firms
        await supabase
          .from('security_firms')
          .update({ is_active: false })
          .eq('company_id', company.id);

        // Factories
        await supabase
          .from('merch_factories')
          .update({ status: 'suspended' })
          .eq('company_id', company.id);

        // Logistics
        await supabase
          .from('logistics_companies')
          .update({ status: 'suspended' })
          .eq('company_id', company.id);

        bankruptciesDeclared++;
        console.log(`[check-company-bankruptcy] BANKRUPTCY: ${company.name}`);

      } else if (daysNegative >= 3) {
        // Issue warning at 3 days
        const { data: existingWarning } = await supabase
          .from('company_notifications')
          .select('id')
          .eq('company_id', company.id)
          .eq('notification_type', 'warning')
          .ilike('title', '%Bankruptcy Warning%')
          .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .single();

        if (!existingWarning) {
          await supabase
            .from('company_notifications')
            .insert({
              company_id: company.id,
              notification_type: 'warning',
              title: 'Bankruptcy Warning',
              message: `${company.name} has been in negative balance for ${daysNegative} days. Bankruptcy will be declared in ${BANKRUPTCY_THRESHOLD_DAYS - daysNegative} days if not resolved.`,
              priority: 'high'
            });

          warningsIssued++;
          console.log(`[check-company-bankruptcy] Warning issued: ${company.name}`);
        }

      } else if (daysNegative >= 1) {
        // Low balance notification at 1 day
        const { data: existingNotice } = await supabase
          .from('company_notifications')
          .select('id')
          .eq('company_id', company.id)
          .eq('notification_type', 'info')
          .ilike('title', '%Negative Balance%')
          .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .single();

        if (!existingNotice) {
          await supabase
            .from('company_notifications')
            .insert({
              company_id: company.id,
              notification_type: 'info',
              title: 'Negative Balance Notice',
              message: `${company.name} has a negative balance of $${Math.abs(company.balance).toLocaleString()}. Please add funds to avoid bankruptcy.`,
              priority: 'medium'
            });

          warningsIssued++;
        }
      }
    }

    // Clear negative_balance_since for companies that recovered
    const { data: recoveredCompanies } = await supabase
      .from('companies')
      .select('id')
      .gte('balance', 0)
      .not('negative_balance_since', 'is', null);

    for (const company of recoveredCompanies || []) {
      await supabase
        .from('companies')
        .update({ negative_balance_since: null })
        .eq('id', company.id);

      await supabase
        .from('company_notifications')
        .insert({
          company_id: company.id,
          notification_type: 'success',
          title: 'Balance Recovered',
          message: 'Your company balance has recovered to positive. Bankruptcy risk has been cleared.',
          priority: 'low'
        });
    }

    console.log(`[check-company-bankruptcy] Complete: ${warningsIssued} warnings, ${bankruptciesDeclared} bankruptcies`);

    return new Response(JSON.stringify({
      success: true,
      warningsIssued,
      bankruptciesDeclared,
      companiesChecked: companies?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[check-company-bankruptcy] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
