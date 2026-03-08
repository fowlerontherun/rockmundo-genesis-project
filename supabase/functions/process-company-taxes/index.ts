import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Progressive tax rates
const TAX_BRACKETS = [
  { min: 0, max: 10000, rate: 0.10 },
  { min: 10001, max: 50000, rate: 0.15 },
  { min: 50001, max: 100000, rate: 0.20 },
  { min: 100001, max: Infinity, rate: 0.25 },
];

function calculateTaxRate(taxableIncome: number): number {
  for (const bracket of TAX_BRACKETS) {
    if (taxableIncome >= bracket.min && taxableIncome <= bracket.max) {
      return bracket.rate;
    }
  }
  return 0.25;
}

// Helper: get owner's band reputation score
async function getOwnerBandReputation(supabase: any, ownerId: string): Promise<{ bandId: string | null; repScore: number }> {
  try {
    const { data: member } = await supabase
      .from('band_members')
      .select('band_id, bands(id, reputation_score)')
      .eq('user_id', ownerId)
      .eq('role', 'leader')
      .limit(1)
      .single();
    if (member?.bands) {
      return { bandId: member.band_id, repScore: member.bands.reputation_score ?? 0 };
    }
  } catch (_e) { /* no band */ }
  return { bandId: null, repScore: 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[process-company-taxes] Starting monthly tax processing...");

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const taxPeriod = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, owner_id, name, balance")
      .eq("status", "active")
      .eq("is_bankrupt", false);

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    console.log(`[process-company-taxes] Processing taxes for ${companies?.length || 0} companies`);

    let taxRecordsCreated = 0;
    let taxesPaidAutomatically = 0;

    for (const company of companies || []) {
      const { data: existingTax } = await supabase
        .from("company_tax_records")
        .select("id")
        .eq("company_id", company.id)
        .eq("tax_period", taxPeriod)
        .single();

      if (existingTax) {
        console.log(`[process-company-taxes] Tax record already exists for ${company.name} - ${taxPeriod}`);
        continue;
      }

      // Fetch owner's band reputation for tax discount
      const { bandId, repScore } = await getOwnerBandReputation(supabase, company.owner_id);
      // Tax modifier: 1.0x (toxic) → 0.9x (iconic) — reputable companies get tax discount
      const taxMod = parseFloat((1.0 - ((repScore + 100) / 200) * 0.1).toFixed(3));

      const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
      const endOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59);

      const { data: transactions } = await supabase
        .from("company_transactions")
        .select("amount, transaction_type")
        .eq("company_id", company.id)
        .gte("created_at", startOfLastMonth.toISOString())
        .lte("created_at", endOfLastMonth.toISOString());

      let grossRevenue = 0;
      let deductibleExpenses = 0;

      for (const tx of transactions || []) {
        const amount = Number(tx.amount);
        if (tx.transaction_type === 'income' || tx.transaction_type === 'investment') {
          grossRevenue += Math.abs(amount);
        } else if (tx.transaction_type === 'expense' || tx.transaction_type === 'salary') {
          deductibleExpenses += Math.abs(amount);
        }
      }

      const taxableIncome = Math.max(0, grossRevenue - deductibleExpenses);
      const taxRate = calculateTaxRate(taxableIncome);
      // Apply reputation-based tax discount
      const baseTax = Math.round(taxableIncome * taxRate);
      const taxAmount = Math.round(baseTax * taxMod);

      if (taxAmount <= 0) {
        console.log(`[process-company-taxes] No tax due for ${company.name} (income: $${taxableIncome})`);
        continue;
      }

      console.log(`[process-company-taxes] ${company.name}: base tax $${baseTax}, repMod ${taxMod}, final $${taxAmount}`);

      const { data: settings } = await supabase
        .from("company_settings")
        .select("auto_pay_taxes")
        .eq("company_id", company.id)
        .single();

      const autoPay = settings?.auto_pay_taxes ?? true;
      const canAfford = Number(company.balance) >= taxAmount;
      const shouldAutoPay = autoPay && canAfford;

      const { error: insertError } = await supabase
        .from("company_tax_records")
        .insert({
          company_id: company.id,
          tax_period: taxPeriod,
          gross_revenue: grossRevenue,
          deductible_expenses: deductibleExpenses,
          taxable_income: taxableIncome,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          status: shouldAutoPay ? 'paid' : 'pending',
          due_date: dueDate.toISOString(),
          paid_at: shouldAutoPay ? now.toISOString() : null,
        });

      if (insertError) {
        console.error(`[process-company-taxes] Failed to create tax record for ${company.name}: ${insertError.message}`);
        continue;
      }

      taxRecordsCreated++;

      if (shouldAutoPay) {
        const { error: updateError } = await supabase
          .from("companies")
          .update({ balance: Number(company.balance) - taxAmount })
          .eq("id", company.id);

        if (!updateError) {
          await supabase.from("company_transactions").insert({
            company_id: company.id,
            transaction_type: "expense",
            amount: -taxAmount,
            description: `Monthly tax payment - ${taxPeriod}`,
          });
          taxesPaidAutomatically++;
          console.log(`[process-company-taxes] Auto-paid $${taxAmount} tax for ${company.name}`);

          // Morale impact: paying taxes is stressful (-2 morale)
          if (bandId) {
            const { data: band } = await supabase
              .from('bands')
              .select('morale')
              .eq('id', bandId)
              .single();
            if (band) {
              const newMorale = Math.max(0, (band.morale ?? 50) - 2);
              await supabase.from('bands').update({ morale: newMorale }).eq('id', bandId);
              console.log(`[process-company-taxes] Applied -2 morale to band ${bandId} (tax stress)`);
              // Health event log (v1.0.998)
              try { await supabase.from('band_health_events').insert({ band_id: bandId, event_type: 'morale', delta: -2, new_value: newMorale, source: 'company_taxes', description: `Monthly tax payment: $${taxAmount.toLocaleString()}` }); } catch (_) {}
            }
          }
        }
      } else if (!canAfford && taxAmount > 0) {
        await supabase.from("notifications").insert({
          user_id: company.owner_id,
          type: "company_alert",
          title: "Tax Payment Due",
          message: `${company.name} owes $${taxAmount.toLocaleString()} in taxes for ${taxPeriod}. Due by ${dueDate.toLocaleDateString()}.`,
          data: { company_id: company.id, tax_period: taxPeriod },
        });
      }
    }

    // Check for overdue taxes
    const { data: overdueTaxes, error: overdueError } = await supabase
      .from("company_tax_records")
      .select("id, company_id, tax_amount")
      .eq("status", "pending")
      .lt("due_date", now.toISOString());

    if (!overdueError && overdueTaxes) {
      for (const tax of overdueTaxes) {
        await supabase
          .from("company_tax_records")
          .update({ status: "overdue" })
          .eq("id", tax.id);
      }
      console.log(`[process-company-taxes] Marked ${overdueTaxes.length} tax records as overdue`);
    }

    console.log(`[process-company-taxes] Complete: ${taxRecordsCreated} records created, ${taxesPaidAutomatically} auto-paid`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        taxRecordsCreated,
        taxesPaidAutomatically,
        taxPeriod,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[process-company-taxes] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
