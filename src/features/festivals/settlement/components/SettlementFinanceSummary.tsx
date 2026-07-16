import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FestivalFinancialResult } from '../types';

export const SettlementFinanceSummary = ({ result }: { result: FestivalFinancialResult | null }) => <Card>
  <CardHeader><CardTitle>Edition finance</CardTitle></CardHeader>
  <CardContent className="text-sm text-muted-foreground">{result ? `Final result recorded in ${String(result.currency_code)}.` : 'Financial result is pending reconciliation.'}</CardContent>
</Card>;
