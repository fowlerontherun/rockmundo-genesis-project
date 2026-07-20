import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Banknote, Building2, CalendarDays, CheckCircle2, Home, KeyRound } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyMinor } from "@/services/banking/currency";

type JsonRecord = Record<string, any>;

function money(amountMinor?: number, currencyCode = "GBP") {
  return formatCurrencyMinor({ amountMinor: amountMinor ?? 0, currencyCode });
}

export function PropertyDetailPage() {
  const { propertyId = "" } = useParams();
  const [detail, setDetail] = useState<JsonRecord | null>(null);
  useEffect(() => { supabase.rpc("get_property_detail" as never, { p_property_id: propertyId } as never).then(({ data }) => setDetail(data as JsonRecord)); }, [propertyId]);
  const property = detail?.property ?? {};
  const products = Array.isArray(detail?.products) ? detail?.products : [];
  return <FMPageScaffold title="Property detail" subtitle="Persistent property data and eligible fixed-rate products." icon={Home} backTo="/finance/properties">
    <Card><CardHeader><CardTitle>{property.district_name ?? "Property"} {property.property_type}</CardTitle><CardDescription>{property.city_name} · {property.size_sqm} sqm · condition {property.condition}% · prestige {property.prestige}</CardDescription></CardHeader><CardContent className="space-y-3"><p className="text-2xl font-bold">{money(property.current_valuation_minor, property.currency_code)}</p><Badge>{property.listing_status ?? "loading"}</Badge><div className="grid gap-2 md:grid-cols-2">{products.map((p: JsonRecord) => <div key={p.id} className="rounded-lg border p-3"><p className="font-semibold">{p.product_name}</p><p className="text-sm text-muted-foreground">{p.providerName} · {(p.annual_rate_bps / 100).toFixed(2)}% fixed · {(p.min_deposit_bps / 100).toFixed(1)}% minimum deposit</p></div>)}</div><Button asChild disabled={products.length === 0}><Link to={`/finance/properties/${propertyId}/mortgage`}><KeyRound className="mr-2 h-4 w-4" />Start mortgage</Link></Button></CardContent></Card>
  </FMPageScaffold>;
}

export function MortgageApplicationPage() {
  const { propertyId = "" } = useParams();
  const [detail, setDetail] = useState<JsonRecord | null>(null);
  const [term, setTerm] = useState(300);
  const [deposit, setDeposit] = useState(2400000);
  const [applicationId, setApplicationId] = useState("");
  const product = useMemo(() => (Array.isArray(detail?.products) ? detail?.products[0] : undefined), [detail]);
  const property = detail?.property ?? {};
  useEffect(() => { supabase.rpc("get_property_detail" as never, { p_property_id: propertyId } as never).then(({ data }) => setDetail(data as JsonRecord)); }, [propertyId]);
  const monthly = product ? Math.ceil((Number(property.current_valuation_minor ?? 0) - deposit) * ((Number(product.annual_rate_bps) / 10000) / 12) / (1 - Math.pow(1 + ((Number(product.annual_rate_bps) / 10000) / 12), -term))) : 0;
  async function submit() {
    if (!product) return;
    const { data } = await supabase.rpc("create_mortgage_application" as never, { p_property_id: propertyId, p_product_id: product.id, p_term_months: term, p_requested_deposit_minor: deposit, p_currency_code: property.currency_code, p_idempotency_key: `ui-mortgage-${propertyId}-${product.id}-${deposit}-${term}` } as never);
    setApplicationId(String(data ?? ""));
  }
  return <FMPageScaffold title="Mortgage application" subtitle="The browser chooses product, deposit and term only; underwriting stays server-side." icon={Banknote} backTo={`/finance/properties/${propertyId}`}>
    <Card><CardHeader><CardTitle>{product?.product_name ?? "No eligible product"}</CardTitle><CardDescription>Application payload excludes income, savings and credit score.</CardDescription></CardHeader><CardContent className="space-y-4"><Input aria-label="Deposit amount" type="number" value={deposit} onChange={(event) => setDeposit(Number(event.target.value))} /><Input aria-label="Term months" type="number" value={term} onChange={(event) => setTerm(Number(event.target.value))} /><p>Indicative monthly payment: <strong>{money(monthly, property.currency_code)}</strong></p><Button onClick={submit} disabled={!product}>Submit authoritative application</Button>{applicationId && <div className="rounded-lg border p-3"><p className="font-semibold">Application submitted</p><Button asChild className="mt-2"><Link to={`/finance/mortgages/${applicationId}`}>Review offer</Link></Button></div>}</CardContent></Card>
  </FMPageScaffold>;
}

export function MortgagesPage() {
  const [mortgages, setMortgages] = useState<JsonRecord[]>([]);
  useEffect(() => { supabase.rpc("list_my_mortgages" as never).then(({ data }) => setMortgages(Array.isArray(data) ? data as JsonRecord[] : [])); }, []);
  return <FMPageScaffold title="Mortgage dashboard" subtitle="Persistent contracts from completed property purchases." icon={Building2} backTo="/finances"><div className="grid gap-3">{mortgages.map((m) => <Card key={m.id}><CardHeader><CardTitle>{money(m.outstandingPrincipalMinor, m.currencyCode)} outstanding</CardTitle><CardDescription>Next payment {m.nextPaymentDueDate ?? "—"}</CardDescription></CardHeader><CardContent><Button asChild><Link to={`/finance/mortgages/${m.id}`}>Open mortgage</Link></Button></CardContent></Card>)}{mortgages.length === 0 && <Card><CardContent className="p-4 text-sm text-muted-foreground">No active mortgages yet.</CardContent></Card>}</div></FMPageScaffold>;
}

export function MortgageDashboardPage() {
  const { mortgageId = "" } = useParams();
  const [dashboard, setDashboard] = useState<JsonRecord | null>(null);
  const [schedule, setSchedule] = useState<JsonRecord[]>([]);
  useEffect(() => { supabase.rpc("get_mortgage_dashboard" as never, { p_mortgage_contract_id: mortgageId } as never).then(({ data }) => setDashboard(data as JsonRecord)); supabase.rpc("get_mortgage_schedule" as never, { p_mortgage_contract_id: mortgageId } as never).then(({ data }) => setSchedule(Array.isArray(data) ? data as JsonRecord[] : [])); }, [mortgageId]);
  const contract = dashboard?.contract ?? {};
  const property = dashboard?.property ?? {};
  const next = dashboard?.nextScheduleLine ?? {};
  return <FMPageScaffold title="Mortgage account" subtitle="Authoritative balance, security and repayment schedule." icon={CheckCircle2} backTo="/finance/mortgages"><div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle>Balance</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{money(contract.outstanding_principal_minor, contract.currency_code)}</p></CardContent></Card><Card><CardHeader><CardTitle>LTV and equity</CardTitle></CardHeader><CardContent><p>{dashboard?.equity?.ltv_bps ? `${(dashboard.equity.ltv_bps / 100).toFixed(1)}% LTV` : "—"}</p><p>{money(dashboard?.equity?.equity_minor, contract.currency_code)} equity</p></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />Next payment</CardTitle></CardHeader><CardContent><p>{next.due_date ?? "—"}</p><p>{money(next.total_due_minor, contract.currency_code)}</p></CardContent></Card></div><Card className="mt-4"><CardHeader><CardTitle>{property.district_name} repayment schedule</CardTitle></CardHeader><CardContent className="space-y-2">{schedule.slice(0, 12).map((line) => <div key={line.id} className="grid grid-cols-4 rounded border p-2 text-sm"><span>{line.instalment_number}</span><span>{line.due_date}</span><span>{money(line.total_due_minor, line.currency_code)}</span><Badge>{line.status}</Badge></div>)}</CardContent></Card></FMPageScaffold>;
}
