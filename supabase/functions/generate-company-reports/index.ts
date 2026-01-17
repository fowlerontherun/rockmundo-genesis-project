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

  console.log('[generate-company-reports] Starting report generation...');

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let reportsGenerated = 0;

    // Get all active companies
    const { data: companies } = await supabase
      .from('companies')
      .select('*')
      .eq('status', 'active');

    console.log(`[generate-company-reports] Generating reports for ${companies?.length || 0} companies`);

    for (const company of companies || []) {
      // Get transactions from last week
      const { data: transactions } = await supabase
        .from('company_transactions')
        .select('*')
        .eq('company_id', company.id)
        .gte('created_at', weekAgo.toISOString())
        .lte('created_at', now.toISOString());

      // Calculate metrics
      let totalRevenue = 0;
      let totalExpenses = 0;
      const revenueByCategory: Record<string, number> = {};
      const expensesByCategory: Record<string, number> = {};

      for (const tx of transactions || []) {
        if (tx.amount > 0) {
          totalRevenue += tx.amount;
          revenueByCategory[tx.category || 'other'] = (revenueByCategory[tx.category || 'other'] || 0) + tx.amount;
        } else {
          totalExpenses += Math.abs(tx.amount);
          expensesByCategory[tx.category || 'other'] = (expensesByCategory[tx.category || 'other'] || 0) + Math.abs(tx.amount);
        }
      }

      const netProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      // Count subsidiaries
      const { count: securityFirmCount } = await supabase
        .from('security_firms')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id);

      const { count: factoryCount } = await supabase
        .from('merch_factories')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id);

      const { count: logisticsCount } = await supabase
        .from('logistics_companies')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id);

      const { count: labelCount } = await supabase
        .from('labels')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id);

      const totalSubsidiaries = (securityFirmCount || 0) + (factoryCount || 0) + (logisticsCount || 0) + (labelCount || 0);

      // Create financial report
      await supabase
        .from('company_financial_reports')
        .insert({
          company_id: company.id,
          report_period: 'weekly',
          period_start: weekAgo.toISOString(),
          period_end: now.toISOString(),
          total_revenue: totalRevenue,
          total_expenses: totalExpenses,
          net_profit: netProfit,
          profit_margin: profitMargin,
          revenue_breakdown: revenueByCategory,
          expense_breakdown: expensesByCategory
        });

      // Update/Insert KPIs
      const kpis = [
        { name: 'Weekly Revenue', value: totalRevenue, unit: 'currency', category: 'financial' },
        { name: 'Weekly Expenses', value: totalExpenses, unit: 'currency', category: 'financial' },
        { name: 'Profit Margin', value: profitMargin, unit: 'percentage', category: 'financial' },
        { name: 'Total Subsidiaries', value: totalSubsidiaries, unit: 'count', category: 'operations' },
        { name: 'Current Balance', value: company.balance || 0, unit: 'currency', category: 'financial' },
      ];

      for (const kpi of kpis) {
        await supabase
          .from('company_kpis')
          .insert({
            company_id: company.id,
            kpi_name: kpi.name,
            kpi_value: kpi.value,
            kpi_unit: kpi.unit,
            category: kpi.category
          });
      }

      // Check and update synergies
      const synergies: { type: string; discount: number; requirement: string }[] = [];

      // Security + Venue synergy
      if ((securityFirmCount || 0) > 0) {
        const { count: venueCount } = await supabase
          .from('venues')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', company.id);

        if ((venueCount || 0) > 0) {
          synergies.push({
            type: 'security_venue',
            discount: 20,
            requirement: 'Own both security firm and venue'
          });
        }
      }

      // Factory + Label synergy
      if ((factoryCount || 0) > 0 && (labelCount || 0) > 0) {
        synergies.push({
          type: 'factory_label',
          discount: 15,
          requirement: 'Own both factory and label'
        });
      }

      // Logistics + Factory synergy
      if ((logisticsCount || 0) > 0 && (factoryCount || 0) > 0) {
        synergies.push({
          type: 'logistics_factory',
          discount: 10,
          requirement: 'Own both logistics company and factory'
        });
      }

      // Insert or update synergies
      for (const synergy of synergies) {
        const { data: existingSynergy } = await supabase
          .from('company_synergies')
          .select('id')
          .eq('company_id', company.id)
          .eq('synergy_type', synergy.type)
          .single();

        if (!existingSynergy) {
          await supabase
            .from('company_synergies')
            .insert({
              company_id: company.id,
              synergy_type: synergy.type,
              synergy_name: synergy.type.replace('_', ' + ').toUpperCase(),
              discount_percentage: synergy.discount,
              is_active: true,
              description: synergy.requirement
            });

          // Notify about new synergy
          await supabase
            .from('company_notifications')
            .insert({
              company_id: company.id,
              notification_type: 'success',
              title: 'New Synergy Unlocked!',
              message: `You've unlocked the ${synergy.type.replace('_', ' + ')} synergy! Enjoy ${synergy.discount}% discount.`,
              priority: 'medium'
            });
        }
      }

      reportsGenerated++;
      console.log(`[generate-company-reports] Report generated for ${company.name}`);
    }

    console.log(`[generate-company-reports] Complete: ${reportsGenerated} reports generated`);

    return new Response(JSON.stringify({
      success: true,
      reportsGenerated
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[generate-company-reports] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
