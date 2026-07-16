import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mapSettlementReadiness } from '../mappers';
import type { Json } from '@/integrations/supabase/types';

interface SettlementReadinessPanelProps { readiness: Json; }

export const SettlementReadinessPanel = ({ readiness }: SettlementReadinessPanelProps) => {
  const summary = mapSettlementReadiness(readiness);
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2">{summary.readyForSettlement ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />} Settlement readiness</CardTitle></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <p>{summary.readyForSettlement ? 'This edition is ready for server-side settlement locking.' : 'This edition has blockers before settlement can be locked.'}</p>
      {summary.blockers.length > 0 && <ul className="list-disc pl-5">{summary.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}
      {summary.warnings.length > 0 && <p className="text-muted-foreground">Warnings: {summary.warnings.join(', ')}</p>}
    </CardContent>
  </Card>;
};
