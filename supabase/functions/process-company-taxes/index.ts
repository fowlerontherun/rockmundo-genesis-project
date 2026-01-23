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
  return 0.25; // Default highest rate
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting monthly tax processing...");

    // Get current tax period (previous month)
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const taxPeriod = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    
    // Due date is 7 days from now
    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get all active companies
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, owner_id, name, balance")
      .eq("status", "active")
      .eq("is_bankrupt", false);

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    console.log(`Processing taxes for ${companies?.length || 0} companies`);

    let taxRecordsCreated = 0;
    let taxesPaidAutomatically = 0;

    for (const company of companies || []) {
      // Check if tax record already exists for this period
      const { data: existingTax } = await supabase
        .from("company_tax_records")
        .select("id")
        .eq("company_id", company.id)
        .eq("tax_period", taxPeriod)
        .single();

      if (existingTax) {
        console.log(`Tax record already exists for ${company.name} - ${taxPeriod}`);
        continue;
      }

      // Get transactions from last month
      const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
      const endOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59);

      const { data: transactions } = await supabase
        .from("company_transactions")
        .select("amount, transaction_type")
        .eq("company_id", company.id)
        .gte("created_at", startOfLastMonth.toISOString())
        .lte("created_at", endOfLastMonth.toISOString());

      // Calculate revenue and expenses
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
      const taxAmount = Math.round(taxableIncome * taxRate);

      // Only create tax record if there's tax to pay
      if (taxAmount <= 0) {
        console.log(`No tax due for ${company.name} (income: $${taxableIncome})`);
        continue;
      }

      // Get company settings for auto-pay
      const { data: settings } = await supabase
        .from("company_settings")
        .select("auto_pay_taxes")
        .eq("company_id", company.id)
        .single();

      const autoPay = settings?.auto_pay_taxes ?? true;
      const canAfford = Number(company.balance) >= taxAmount;
      const shouldAutoPay = autoPay && canAfford;

      // Create tax record
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
        console.error(`Failed to create tax record for ${company.name}: ${insertError.message}`);
        continue;
      }

      taxRecordsCreated++;

      // Auto-pay if enabled and affordable
      if (shouldAutoPay) {
        const { error: updateError } = await supabase
          .from("companies")
          .update({ balance: Number(company.balance) - taxAmount })
          .eq("id", company.id);

        if (!updateError) {
          // Record transaction
          await supabase.from("company_transactions").insert({
            company_id: company.id,
            transaction_type: "expense",
            amount: -taxAmount,
            description: `Monthly tax payment - ${taxPeriod}`,
          });
          taxesPaidAutomatically++;
          console.log(`Auto-paid $${taxAmount} tax for ${company.name}`);
        }
      } else if (!canAfford && taxAmount > 0) {
        // Send notification about unpaid taxes
        await supabase.from("notifications").insert({
          user_id: company.owner_id,
          type: "company_alert",
          title: "Tax Payment Due",
          message: `${company.name} owes $${taxAmount.toLocaleString()} in taxes for ${taxPeriod}. Due by ${dueDate.toLocaleDateString()}.`,
          data: { company_id: company.id, tax_period: taxPeriod },
        });
      }
    }

    // Check for overdue taxes and update status
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
      console.log(`Marked ${overdueTaxes.length} tax records as overdue`);
    }

    console.log(`Tax processing complete: ${taxRecordsCreated} records created, ${taxesPaidAutomatically} auto-paid`);

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
    console.error("Tax processing error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
