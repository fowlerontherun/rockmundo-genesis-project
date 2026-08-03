import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw, Loader2, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type Client = { from: (table: string) => any; rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
const client = supabase as unknown as Client;

/** Every table the finance command centre RPC reads, and the payload section it feeds. */
const FINANCE_SOURCES: Array<{ table: string; feeds: string; scope: "profile" | "global"; column?: string }> = [
  { table: "profiles", feeds: "Cash on hand / net worth", scope: "profile", column: "id" },
  { table: "bank_accounts", feeds: "Accounts & balances", scope: "profile", column: "profile_id" },
  { table: "bank_transactions", feeds: "Recent activity, monthly ledger", scope: "global" },
  { table: "player_investments", feeds: "Investments & portfolio value", scope: "profile", column: "profile_id" },
  { table: "player_loans", feeds: "Active loans & obligations", scope: "profile", column: "profile_id" },
  { table: "band_members", feeds: "Band treasury lookup", scope: "profile", column: "profile_id" },
  { table: "bands", feeds: "Band balances", scope: "global" },
];

type ProbeResult = { table: string; feeds: string; count: number | null; error: string | null };

const countRows = async (table: string, column: string | undefined, profileId: string | null): Promise<ProbeResult["count"] | { error: string }> => {
  let query = client.from(table).select("*", { count: "exact", head: true });
  if (column && profileId) query = query.eq(column, profileId);
  const { count, error } = await query;
  if (error) return { error: error.message as string };
  return (count ?? 0) as number;
};

const FinanceDiagnostics = () => {
  const { profileId } = useActiveProfile();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [refreshing, setRefreshing] = useState(false);
  const admin = isAdmin();

  const probe = useQuery({
    queryKey: ["admin-finance-diagnostics", profileId],
    enabled: admin,
    queryFn: async () => {
      const rpcResult = await client.rpc("get_my_finance_command_center", { p_transaction_limit: 10 });
      const results: ProbeResult[] = [];
      for (const source of FINANCE_SOURCES) {
        const outcome = await countRows(source.table, source.scope === "profile" ? source.column : undefined, profileId ?? null);
        if (typeof outcome === "number") results.push({ table: source.table, feeds: source.feeds, count: outcome, error: null });
        else results.push({ table: source.table, feeds: source.feeds, count: null, error: outcome.error });
      }
      return { rpcError: rpcResult.error?.message ?? null, payload: (rpcResult.data ?? null) as Record<string, unknown> | null, results };
    },
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await probe.refetch();
    setRefreshing(false);
  }, [probe]);

  if (roleLoading) return <div className="p-6"><Skeleton className="h-40 w-full" /></div>;

  if (!admin) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Admins only</AlertTitle>
          <AlertDescription>This diagnostics view is restricted to administrators.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const payload = probe.data?.payload;
  const payloadSections: Array<{ key: string; label: string }> = [
    { key: "accounts", label: "Accounts" },
    { key: "investments", label: "Investments" },
    { key: "loans", label: "Loans" },
    { key: "transactions", label: "Recent activity" },
    { key: "monthlyLedger", label: "Monthly ledger" },
    { key: "earningsBreakdown", label: "Earnings breakdown" },
    { key: "bands", label: "Band treasuries" },
  ];

  const emptySections = payloadSections.filter((section) => {
    const value = payload?.[section.key];
    return Array.isArray(value) ? value.length === 0 : value == null;
  });
  const failedTables = (probe.data?.results ?? []).filter((row) => row.error);
  const emptyTables = (probe.data?.results ?? []).filter((row) => !row.error && row.count === 0);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><Database className="h-5 w-5 text-primary" /> Finance RPC Diagnostics</h1>
          <p className="text-xs text-muted-foreground">Sources read by <code>get_my_finance_command_center</code> for the active character.</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing || probe.isFetching}>
          {refreshing || probe.isFetching ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
          Re-run probe
        </Button>
      </div>

      {probe.data?.rpcError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>RPC call failed</AlertTitle>
          <AlertDescription className="break-words text-xs">{probe.data.rpcError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Table probes</CardTitle>
          <CardDescription className="text-xs">Row counts are RLS-scoped to the signed-in admin's own records where the table is per-character.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {probe.isLoading ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Table</TableHead>
                  <TableHead className="text-xs">Feeds</TableHead>
                  <TableHead className="text-right text-xs">Rows</TableHead>
                  <TableHead className="text-right text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(probe.data?.results ?? []).map((row) => (
                  <TableRow key={row.table}>
                    <TableCell className="font-mono text-[11px]">{row.table}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{row.feeds}</TableCell>
                    <TableCell className="text-right text-[11px]">{row.error ? "—" : row.count}</TableCell>
                    <TableCell className="text-right">
                      {row.error ? (
                        <Badge variant="destructive" className="text-[10px]">Unreachable</Badge>
                      ) : row.count === 0 ? (
                        <Badge variant="outline" className="border-amber-500/60 text-[10px] text-amber-500">Empty</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">RPC payload sections</CardTitle>
          <CardDescription className="text-xs">Highlights sections the dashboard will render as blank.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {payloadSections.map((section) => {
            const value = payload?.[section.key];
            const isEmpty = Array.isArray(value) ? value.length === 0 : value == null;
            return (
              <Badge key={section.key} variant={isEmpty ? "outline" : "secondary"} className={`text-[10px] ${isEmpty ? "border-amber-500/60 text-amber-500" : ""}`}>
                {section.label}: {Array.isArray(value) ? `${value.length}` : value == null ? "missing" : "present"}
              </Badge>
            );
          })}
        </CardContent>
      </Card>

      {!probe.isLoading && (
        <Alert>
          {failedTables.length === 0 && emptySections.length === 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
          <AlertTitle className="text-sm">Summary</AlertTitle>
          <AlertDescription className="text-xs">
            {failedTables.length > 0 && <span className="block">Unreachable tables: {failedTables.map((t) => t.table).join(", ")}.</span>}
            {emptyTables.length > 0 && <span className="block">Empty tables: {emptyTables.map((t) => t.table).join(", ")}.</span>}
            {emptySections.length > 0 && <span className="block">Blank payload sections: {emptySections.map((s) => s.label).join(", ")}.</span>}
            {failedTables.length === 0 && emptySections.length === 0 && <span>All finance sources responded with data.</span>}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default FinanceDiagnostics;
