import { AlertTriangle, CheckCircle2, GitCompareArrows, RotateCcw } from "lucide-react";
import { ACTIVE_BALANCE_VERSION, cloneDraft } from "@/balance/versions";
import { compareBalanceVersions, runBalanceGate, runProgressionScenarios } from "@/balance/simulations";
import { DEFAULT_BALANCE_CONFIG } from "@/balance/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
export function BalanceManagementDashboard() {
  const gate = runBalanceGate(DEFAULT_BALANCE_CONFIG);
  const draft = cloneDraft(ACTIVE_BALANCE_VERSION, "preview-admin", new Date("2026-07-13T00:00:00.000Z"));
  const scenarios = runProgressionScenarios(DEFAULT_BALANCE_CONFIG).slice(0, 4);
  const diffs = compareBalanceVersions(DEFAULT_BALANCE_CONFIG, {...DEFAULT_BALANCE_CONFIG, practice:{...DEFAULT_BALANCE_CONFIG.practice, baseRewardXp: DEFAULT_BALANCE_CONFIG.practice.baseRewardXp + 10}}).slice(0, 5);
  return <div className="space-y-4" data-testid="balance-management-dashboard">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600"/>Balance management</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3"><div><p className="text-sm text-muted-foreground">Active version</p><p className="font-semibold">{ACTIVE_BALANCE_VERSION.versionKey}</p></div><div><p className="text-sm text-muted-foreground">Validation</p><Badge variant={gate.ok ? "default" : "destructive"}>{gate.ok ? "valid" : "blocked"}</Badge></div><div><p className="text-sm text-muted-foreground">Draft example</p><p className="font-mono text-xs">{draft.versionKey}</p></div></div>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline">Clone active</Button><Button size="sm" variant="outline"><GitCompareArrows className="mr-2 h-4 w-4"/>Compare draft</Button><Button size="sm" variant="outline"><RotateCcw className="mr-2 h-4 w-4"/>Rollback</Button></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Warnings and critical failures</CardTitle></CardHeader><CardContent>{gate.issues.length === 0 ? <p className="text-sm text-muted-foreground">No blocking balance issues detected.</p> : <ul className="space-y-2">{gate.issues.map(i => <li key={`${i.code}-${i.path}`} className="flex gap-2 text-sm"><AlertTriangle className="h-4 w-4"/> <span><b>{i.severity}</b> {i.path}: {i.message}</span></li>)}</ul>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Core simulation preview</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Scenario</th><th>Days</th><th>Level</th><th>AP earned</th><th>Sharpness</th></tr></thead><tbody>{scenarios.map(s => <tr key={s.key}><td>{s.key}</td><td className="text-center">{s.days}</td><td className="text-center">{s.level}</td><td className="text-center">{s.apEarned}</td><td className="text-center">{Math.round(s.maintenanceSharpness*100)}%</td></tr>)}</tbody></table></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Readable diff preview</CardTitle></CardHeader><CardContent><ul className="space-y-1 text-sm">{diffs.map(d => <li key={d.key}>{d.key}: {d.current} → {d.proposed} ({d.percentDelta.toFixed(1)}%)</li>)}</ul></CardContent></Card>
  </div>;
}
export default BalanceManagementDashboard;
