import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StaffMember {
  salary: number;
  name: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[process-company-payroll] Starting payroll processing...');

  try {
    // Get all active companies with auto_pay_salaries enabled
    const { data: companiesWithSettings, error: settingsError } = await supabase
      .from('company_settings')
      .select(`
        company_id,
        auto_pay_salaries,
        companies!inner(
          id,
          name,
          balance,
          status
        )
      `)
      .eq('auto_pay_salaries', true);

    if (settingsError) {
      console.error('[process-company-payroll] Error fetching settings:', settingsError);
      throw settingsError;
    }

    console.log(`[process-company-payroll] Found ${companiesWithSettings?.length || 0} companies with auto-pay enabled`);

    let processedCount = 0;
    let totalPaid = 0;

    for (const setting of companiesWithSettings || []) {
      const company = setting.companies as any;
      if (!company || company.status !== 'active') continue;

      let totalSalary = 0;
      const salaryDetails: { source: string; amount: number }[] = [];

      // Get security firm guards
      const { data: securityFirms } = await supabase
        .from('security_firms')
        .select('id')
        .eq('company_id', company.id);

      for (const firm of securityFirms || []) {
        const { data: guards } = await supabase
          .from('security_guards')
          .select('salary, name')
          .eq('security_firm_id', firm.id)
          .eq('is_available', true);

        const guardSalaries = (guards || []).reduce((sum: number, g: StaffMember) => sum + (g.salary || 0), 0);
        if (guardSalaries > 0) {
          totalSalary += guardSalaries;
          salaryDetails.push({ source: 'security_guards', amount: guardSalaries });
        }
      }

      // Get merch factory workers
      const { data: factories } = await supabase
        .from('merch_factories')
        .select('id')
        .eq('company_id', company.id);

      for (const factory of factories || []) {
        const { data: workers } = await supabase
          .from('factory_workers')
          .select('weekly_salary, name')
          .eq('factory_id', factory.id)
          .eq('status', 'active');

        const workerSalaries = (workers || []).reduce((sum: number, w: any) => sum + ((w.weekly_salary || 0) / 7), 0);
        if (workerSalaries > 0) {
          totalSalary += workerSalaries;
          salaryDetails.push({ source: 'factory_workers', amount: workerSalaries });
        }
      }

      // Get logistics company drivers
      const { data: logisticsCompanies } = await supabase
        .from('logistics_companies')
        .select('id')
        .eq('company_id', company.id);

      for (const lc of logisticsCompanies || []) {
        const { data: drivers } = await supabase
          .from('logistics_drivers')
          .select('weekly_salary, name')
          .eq('logistics_company_id', lc.id)
          .eq('status', 'active');

        const driverSalaries = (drivers || []).reduce((sum: number, d: any) => sum + ((d.weekly_salary || 0) / 7), 0);
        if (driverSalaries > 0) {
          totalSalary += driverSalaries;
          salaryDetails.push({ source: 'logistics_drivers', amount: driverSalaries });
        }
      }

      // Get label staff (if labels are owned by company)
      const { data: labels } = await supabase
        .from('labels')
        .select('id')
        .eq('company_id', company.id);

      for (const label of labels || []) {
        const { data: labelStaff } = await supabase
          .from('label_staff')
          .select('salary, name')
          .eq('label_id', label.id)
          .eq('is_active', true);

        const staffSalaries = (labelStaff || []).reduce((sum: number, s: StaffMember) => sum + ((s.salary || 0) / 7), 0);
        if (staffSalaries > 0) {
          totalSalary += staffSalaries;
          salaryDetails.push({ source: 'label_staff', amount: staffSalaries });
        }
      }

      if (totalSalary > 0) {
        // Deduct from company balance
        const newBalance = (company.balance || 0) - totalSalary;
        
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
            amount: -totalSalary,
            description: 'Daily payroll',
            category: 'salaries',
            metadata: { details: salaryDetails }
          });

        // Check for low balance warning
        if (newBalance < 10000) {
          await supabase
            .from('company_notifications')
            .insert({
              company_id: company.id,
              notification_type: 'warning',
              title: 'Low Balance Warning',
              message: `Company balance is low: $${newBalance.toLocaleString()}. Consider adding funds.`,
              priority: newBalance < 0 ? 'critical' : 'high'
            });
        }

        processedCount++;
        totalPaid += totalSalary;
        console.log(`[process-company-payroll] Processed ${company.name}: $${totalSalary.toFixed(2)}`);
      }
    }

    console.log(`[process-company-payroll] Complete: ${processedCount} companies, $${totalPaid.toFixed(2)} total`);

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      totalPaid
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[process-company-payroll] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
