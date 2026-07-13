import { Link } from "react-router-dom";
import { Building2, Briefcase, DollarSign, Megaphone, Search, Users } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import { businessHubNavigation } from "@/config/hubNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanies, useCompanyFinancialSummary } from "@/hooks/useCompanies";
import { Skeleton } from "@/components/ui/skeleton";

const formatCurrency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

export default function BusinessOverview() {
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const { data: financialSummary, isLoading: summaryLoading } = useCompanyFinancialSummary();
  const hasCompanies = Boolean(companies?.length);

  const actions = [
    { label: "Browse companies", path: "/world/companies", icon: Search },
    { label: "Find a job", path: "/career/employment", icon: Briefcase },
    { label: "Manage companies", path: "/business/companies", icon: Building2 },
  ];

  return (
    <HubLayout
      title="Business"
      description="Manage owned companies, staff, recruitment, company finances, advertising, labels and operational reports without mixing them with public discovery or personal career progress."
      icon={Building2}
      overviewPath="/business"
      navigation={businessHubNavigation}
      actions={actions}
    >
      {companiesLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32" />)}</div>
      ) : hasCompanies ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader><CardTitle className="text-sm">Companies managed</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{companies?.length ?? 0}</p><p className="text-sm text-muted-foreground">Active company context remains entity-specific on legacy management routes.</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Company cash</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{summaryLoading ? "—" : formatCurrency(financialSummary?.total_balance ?? 0)}</p><p className="text-sm text-muted-foreground">Company balances only.</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">30-day revenue</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{summaryLoading ? "—" : formatCurrency(financialSummary?.monthly_income ?? 0)}</p><p className="text-sm text-muted-foreground">Authoritative company income summary.</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">30-day profit/loss</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{summaryLoading ? "—" : formatCurrency(financialSummary?.monthly_net ?? 0)}</p><p className="text-sm text-muted-foreground">Includes existing company expenses.</p></CardContent></Card>
          </section>
          <section className="grid gap-4 md:grid-cols-3">
            <Button asChild variant="outline"><Link to="/business/companies"><Building2 className="mr-2 h-4 w-4" />Open companies</Link></Button>
            <Button asChild variant="outline"><Link to="/business/finances"><DollarSign className="mr-2 h-4 w-4" />Review company finances</Link></Button>
            <Button asChild variant="outline"><Link to="/business/recruitment"><Users className="mr-2 h-4 w-4" />Review recruitment</Link></Button>
          </section>
        </div>
      ) : (
        <Card className="border-dashed"><CardContent className="py-10 text-center"><Building2 className="mx-auto mb-4 h-10 w-10 text-primary" /><h2 className="text-xl font-semibold">No business to manage yet</h2><p className="mx-auto mt-2 max-w-2xl text-muted-foreground">Business is for company operations. Discover public companies in World, look for employment in Career, or create a company from the Companies page when you are ready.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Button asChild><Link to="/business/companies">Create or manage companies</Link></Button><Button asChild variant="outline"><Link to="/world/companies">Browse public companies</Link></Button><Button asChild variant="outline"><Link to="/career/employment">Find a job</Link></Button></div></CardContent></Card>
      )}
    </HubLayout>
  );
}
