import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, Package, Music, Radio, AlertTriangle } from "lucide-react";
import { minorToMajor } from "@/lib/releaseMoney";
import { resolveActiveBandMembership } from "@/utils/activeBandMembership";

interface ReleaseSalesTabProps { userId: string; authUserId?: string | null }
type Summary = { gross_cents:number; tax_cents:number; dist_cents:number; manufacturer_cents:number; net_before_label_cents:number; label_cents:number; band_revenue_cents:number; units:number; economic_cost_cents:number; band_cost_cents:number; label_cost_cents:number; unknown_cost_cents:number };
const money = (minor:number) => minorToMajor(minor || 0).toLocaleString(undefined,{style:"currency",currency:"USD"});

export function ReleaseSalesTab({ userId, authUserId }: ReleaseSalesTabProps) {
  const health = useQuery({ queryKey:["release-finance-health"], queryFn:async()=>{
    const {data,error}=await (supabase as any).rpc("get_release_finance_health");
    if(error) throw error;
    if(!data?.ready || Number(data.contract_version)<2) throw new Error("Incomplete release finance backend");
    return data;
  }, retry:false });
  const { data: finance, isLoading, error } = useQuery({
    queryKey:["release-financial-summary",userId,authUserId], queryFn:async()=>{
      const membership=await resolveActiveBandMembership(userId,authUserId);
      if (!membership) return null;
      const rows: Summary[]=[];
      for (const bandId of [membership.band_id]) {
        const { data,error }=await (supabase as any).rpc("get_release_financial_summary",{p_release_id:null,p_band_id:bandId});
        if(error) throw error; rows.push(...(data||[]));
      }
      return rows.reduce((a,r)=>{ Object.keys(a).forEach(k=>a[k as keyof Summary]+=Number(r[k as keyof Summary]||0)); return a; },{gross_cents:0,tax_cents:0,dist_cents:0,manufacturer_cents:0,net_before_label_cents:0,label_cents:0,band_revenue_cents:0,units:0,economic_cost_cents:0,band_cost_cents:0,label_cost_cents:0,unknown_cost_cents:0} as Summary);
    }, enabled:health.isSuccess, retry:false
  });
  const { data: streaming }=useQuery({queryKey:["streaming-revenue",userId],queryFn:async()=>{const {data,error}=await supabase.from("song_releases").select("total_streams,total_revenue").eq("user_id",userId).eq("is_active",true).eq("release_type","streaming");if(error)throw error;return {streams:(data||[]).reduce((s,r)=>s+(r.total_streams||0),0),revenue:(data||[]).reduce((s,r)=>s+(r.total_revenue||0),0)};}});
  if(health.isLoading||isLoading) return <div>Loading financial data…</div>;
  if(health.error||error) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertDescription>Release financial data is temporarily unavailable.</AlertDescription></Alert>;
  if(!finance) return <Alert><AlertTriangle className="h-4 w-4"/><AlertDescription>You are not currently an active member of a band. Existing releases remain available in My Releases.</AlertDescription></Alert>;
  const profit=finance.band_revenue_cents-finance.band_cost_cents;
  const cards=[["Gross Sales",money(finance.gross_cents),DollarSign],["Band Revenue",money(finance.band_revenue_cents),DollarSign],["Costs Paid by Band",money(finance.band_cost_cents),Package],["Band Profit / Loss",money(profit),DollarSign],["Units Sold",finance.units.toLocaleString(),Package],["Streams",(streaming?.streams||0).toLocaleString(),Music]] as const;
  return <div className="space-y-6">
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">{cards.map(([label,value,Icon])=><Card key={label}><CardContent className="p-4"><div className="text-xs text-muted-foreground flex gap-1"><Icon className="h-4 w-4"/>{label}</div><div className="text-xl font-bold mt-1">{value}</div></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Recorded-release financial breakdown</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
      {[["Gross sales",finance.gross_cents],["Sales tax",-finance.tax_cents],["Distributor fees",-finance.dist_cents],["Manufacturer revenue share",-finance.manufacturer_cents],["Net revenue before label",finance.net_before_label_cents],["Label share",-finance.label_cents],["Band revenue received",finance.band_revenue_cents]].map(([l,v])=><div className="flex justify-between" key={l as string}><span>{l}</span><strong>{money(v as number)}</strong></div>)}
      <hr/>{[["Economic release costs",finance.economic_cost_cents],["Paid by band",finance.band_cost_cents],["Paid by label",finance.label_cost_cents],["Band profit / loss",profit]].map(([l,v])=><div className="flex justify-between" key={l as string}><span>{l}</span><strong>{money(v as number)}</strong></div>)}
      {finance.unknown_cost_cents>0&&<Alert><AlertTriangle className="h-4 w-4"/><AlertDescription>Some legacy costs ({money(finance.unknown_cost_cents)}) could not be attributed to band or label. They are excluded from band profit.</AlertDescription></Alert>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="flex gap-2"><Radio className="h-5 w-5"/>Streaming accounting (separate)</CardTitle></CardHeader><CardContent>{(streaming?.streams||0).toLocaleString()} streams · ${(streaming?.revenue||0).toLocaleString()} revenue</CardContent></Card>
  </div>;
}
