import { Progress } from '@/components/ui/progress';
import type { FestivalSettlementStatus } from '../types';

const order: FestivalSettlementStatus[] = ['locked', 'applying_effects', 'settling_contracts', 'settling_revenue', 'reconciling', 'completed'];
export const SettlementProgress = ({ status }: { status: FestivalSettlementStatus }) => {
  const index = Math.max(order.indexOf(status), 0);
  return <div className="space-y-2"><Progress value={status === 'completed' ? 100 : (index / (order.length - 1)) * 100} /><p className="text-sm text-muted-foreground">Settlement status: {status.replace(/_/g, ' ')}</p></div>;
};
