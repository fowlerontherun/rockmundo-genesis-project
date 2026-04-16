import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Clock, DollarSign, CheckCircle2, XCircle } from "lucide-react";

interface CompanyContractBoardProps {
  companyId: string;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  security: "🛡️ Security",
  merch_production: "👕 Merch Production",
  logistics: "🚚 Logistics",
  venue_booking: "🎤 Venue Booking",
  studio_session: "🎙️ Studio Session",
  distribution: "📦 Distribution",
  marketing: "📣 Marketing",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available: { label: "Available", color: "bg-blue-500/20 text-blue-400 border-blue-400/30" },
  active: { label: "Active", color: "bg-emerald-500/20 text-emerald-400 border-emerald-400/30" },
  completed: { label: "Completed", color: "bg-muted text-muted-foreground" },
  expired: { label: "Expired", color: "bg-destructive/20 text-destructive" },
};

export function CompanyContractBoard({ companyId }: CompanyContractBoardProps) {
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['company-service-contracts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_service_contracts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded" />)}</div>;
  }

  const activeContracts = contracts.filter(c => c.status === 'active');
  const availableContracts = contracts.filter(c => c.status === 'available');
  const completedContracts = contracts.filter(c => c.status === 'completed');
  const totalEarned = contracts.reduce((s, c) => s + Number(c.revenue_earned), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="bg-card/60">
          <CardContent className="p-2.5 text-center">
            <p className="text-sm font-bold">{availableContracts.length}</p>
            <p className="text-[10px] text-muted-foreground">Available</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60">
          <CardContent className="p-2.5 text-center">
            <p className="text-sm font-bold text-emerald-400">{activeContracts.length}</p>
            <p className="text-[10px] text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60">
          <CardContent className="p-2.5 text-center">
            <p className="text-sm font-bold">{completedContracts.length}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60">
          <CardContent className="p-2.5 text-center">
            <p className="text-sm font-bold text-emerald-400">${totalEarned.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Total Earned</p>
          </CardContent>
        </Card>
      </div>

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <h3 className="font-semibold">No Service Contracts</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Build reputation to unlock service contract opportunities.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {contracts.map((contract) => {
            const statusCfg = STATUS_CONFIG[contract.status] || STATUS_CONFIG.available;
            return (
              <Card key={contract.id} className="bg-card/60">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {SERVICE_TYPE_LABELS[contract.service_type] || contract.service_type}
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${statusCfg.color}`}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Client: {contract.client_name}</span>
                        <span className="flex items-center gap-0.5">
                          <DollarSign className="h-3 w-3" />
                          ${Number(contract.contract_value).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {contract.duration_weeks}w
                        </span>
                      </div>
                    </div>
                    {contract.status === 'available' && (
                      <Button size="sm" className="h-7 text-xs">Accept</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
