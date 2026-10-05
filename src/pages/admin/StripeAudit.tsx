import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Tx = { id:string; created:string; type:string; amount:number; fee:number; net:number; currency:string; status:string; description:string|null; reporting_category:string; source:string|null };
type Payload = { transactions:Tx[]; summary:{gross:number;fees:number;net:number;count:number}; has_more:boolean; next_cursor:string|null; range:{from:string|null;to:string|null} };

const money=(value:number,currency:string)=>new Intl.NumberFormat(undefined,{style:"currency",currency:currency.toUpperCase()}).format(value/100);
const today=()=>new Date().toISOString().slice(0,10);
const daysAgo=(days:number)=>{const d=new Date();d.setUTCDate(d.getUTCDate()-days);return d.toISOString().slice(0,10);};

export default function StripeAudit(){
  const [from,setFrom]=useState(daysAgo(30));
  const [to,setTo]=useState(today());
  const [applied,setApplied]=useState({from:daysAgo(30),to:today()});

  const query=useQuery({
    queryKey:["admin-stripe-audit",applied],
    queryFn:async()=>{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session) throw new Error("You must be signed in.");
      const params=new URLSearchParams({from:applied.from,to:applied.to});
      const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-stripe-audit?${params}`,{headers:{Authorization:`Bearer ${session.access_token}`}});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error||"Unable to load Stripe transactions.");
      return body as Payload;
    }
  });

  const currency=useMemo(()=>query.data?.transactions[0]?.currency||"gbp",[query.data]);
  return <div className="space-y-4 p-4 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-xl font-semibold"><CreditCard className="h-5 w-5 text-primary"/>Stripe Audit</h1><p className="text-xs text-muted-foreground">Live Stripe balance transactions. Admin access only.</p></div>
      <Button variant="outline" size="sm" onClick={()=>query.refetch()} disabled={query.isFetching}>{query.isFetching?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<RefreshCw className="mr-2 h-4 w-4"/>}Refresh</Button>
    </div>
    <Card><CardHeader><CardTitle className="text-sm">Date filter</CardTitle><CardDescription>Dates are interpreted in UTC and include the full selected days.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-end gap-3">
      <label className="space-y-1 text-xs">From<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label className="space-y-1 text-xs">To<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
      <Button onClick={()=>setApplied({from,to})} disabled={!from||!to||from>to}>Apply</Button>
    </CardContent></Card>
    {query.error&&<Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Stripe audit unavailable</AlertTitle><AlertDescription>{query.error.message}</AlertDescription></Alert>}
    {query.data&&<div className="grid gap-3 sm:grid-cols-4">
      <Card><CardHeader className="pb-1"><CardDescription>Transactions</CardDescription><CardTitle>{query.data.summary.count}</CardTitle></CardHeader></Card>
      <Card><CardHeader className="pb-1"><CardDescription>Gross</CardDescription><CardTitle>{money(query.data.summary.gross,currency)}</CardTitle></CardHeader></Card>
      <Card><CardHeader className="pb-1"><CardDescription>Stripe fees</CardDescription><CardTitle>{money(query.data.summary.fees,currency)}</CardTitle></CardHeader></Card>
      <Card><CardHeader className="pb-1"><CardDescription>Net</CardDescription><CardTitle>{money(query.data.summary.net,currency)}</CardTitle></CardHeader></Card>
    </div>}
    <Card><CardHeader><CardTitle className="text-sm">Transactions</CardTitle><CardDescription>Gross, fees and net values come directly from Stripe's balance ledger.</CardDescription></CardHeader><CardContent className="p-0 overflow-x-auto">
      {query.isLoading?<div className="p-6 text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>Loading Stripe transactions…</div>:
      <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Fee</TableHead><TableHead className="text-right">Net</TableHead><TableHead>ID</TableHead></TableRow></TableHeader>
      <TableBody>{(query.data?.transactions||[]).map(tx=><TableRow key={tx.id}><TableCell className="whitespace-nowrap text-xs">{new Date(tx.created).toLocaleString()}</TableCell><TableCell className="text-xs">{tx.type}</TableCell><TableCell className="max-w-64 truncate text-xs">{tx.description||tx.reporting_category}</TableCell><TableCell className="text-xs">{tx.status}</TableCell><TableCell className="text-right text-xs">{money(tx.amount,tx.currency)}</TableCell><TableCell className="text-right text-xs">{money(tx.fee,tx.currency)}</TableCell><TableCell className="text-right text-xs">{money(tx.net,tx.currency)}</TableCell><TableCell className="font-mono text-[10px]">{tx.id}</TableCell></TableRow>)}</TableBody></Table>}
      {query.data?.has_more&&<p className="p-3 text-xs text-amber-500">More than 100 transactions match this range. Narrow the dates for a complete audit view.</p>}
    </CardContent></Card>
  </div>;
}