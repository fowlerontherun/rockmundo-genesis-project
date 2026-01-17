import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, MapPin, Truck, DollarSign, Clock, CheckCircle, XCircle } from "lucide-react";
import { useLogisticsContracts, useUpdateContractStatus } from "@/hooks/useLogisticsBusiness";
import { CONTRACT_TYPES } from "@/types/logistics-business";
import { format } from "date-fns";
import { toast } from "sonner";

interface LogisticsContractsManagerProps {
  logisticsCompanyId: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/30',
  accepted: 'bg-info/10 text-info border-info/30',
  in_progress: 'bg-primary/10 text-primary border-primary/30',
  completed: 'bg-success/10 text-success border-success/30',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/30',
  disputed: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function LogisticsContractsManager({ logisticsCompanyId }: LogisticsContractsManagerProps) {
  const { data: contracts = [], isLoading } = useLogisticsContracts(logisticsCompanyId);
  const updateStatus = useUpdateContractStatus();

  const handleAcceptContract = async (contractId: string) => {
    try {
      await updateStatus.mutateAsync({ contractId, status: 'accepted' });
      toast.success("Contract accepted!");
    } catch (error) {
      toast.error("Failed to accept contract");
    }
  };

  const handleDeclineContract = async (contractId: string) => {
    try {
      await updateStatus.mutateAsync({ contractId, status: 'cancelled' });
      toast.info("Contract declined");
    } catch (error) {
      toast.error("Failed to decline contract");
    }
  };

  const handleStartContract = async (contractId: string) => {
    try {
      await updateStatus.mutateAsync({ contractId, status: 'in_progress' });
      toast.success("Contract started!");
    } catch (error) {
      toast.error("Failed to start contract");
    }
  };

  const handleCompleteContract = async (contractId: string) => {
    try {
      await updateStatus.mutateAsync({ contractId, status: 'completed' });
      toast.success("Contract completed!");
    } catch (error) {
      toast.error("Failed to complete contract");
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading contracts...</div>;
  }

  const pendingContracts = contracts.filter(c => c.status === 'pending');
  const activeContracts = contracts.filter(c => ['accepted', 'in_progress'].includes(c.status));
  const completedContracts = contracts.filter(c => c.status === 'completed');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Contracts
        </CardTitle>
        <CardDescription>
          {pendingContracts.length} pending • {activeContracts.length} active • {completedContracts.length} completed
        </CardDescription>
      </CardHeader>
      <CardContent>
        {contracts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No contracts yet</p>
            <p className="text-sm">Contracts will appear when bands hire your services</p>
          </div>
        ) : (
          <div className="space-y-4">
            {contracts.map((contract) => {
              const contractType = CONTRACT_TYPES.find(t => t.value === contract.contract_type);
              return (
                <div
                  key={contract.id}
                  className="p-4 rounded-lg border bg-card space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{contractType?.label || contract.contract_type}</h4>
                        <Badge className={STATUS_COLORS[contract.status] || ''}>
                          {contract.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      {contract.cargo_description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {contract.cargo_description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-success">
                        ${contract.fee_quoted?.toLocaleString()}
                      </p>
                      {contract.fee_paid > 0 && contract.fee_paid < contract.fee_quoted && (
                        <p className="text-xs text-muted-foreground">
                          Paid: ${contract.fee_paid?.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Contract Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    {contract.distance_km && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{contract.distance_km} km</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Truck className="h-3 w-3" />
                      <span>{contract.vehicles_required} vehicle(s)</span>
                    </div>
                    {contract.estimated_duration_hours && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{contract.estimated_duration_hours}h est.</span>
                      </div>
                    )}
                    {contract.start_date && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{format(new Date(contract.start_date), "MMM d")}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {contract.status === 'pending' && (
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptContract(contract.id)}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeclineContract(contract.id)}
                        disabled={updateStatus.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  )}
                  {contract.status === 'accepted' && (
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleStartContract(contract.id)}
                        disabled={updateStatus.isPending}
                      >
                        <Truck className="h-4 w-4 mr-1" />
                        Start Trip
                      </Button>
                    </div>
                  )}
                  {contract.status === 'in_progress' && (
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleCompleteContract(contract.id)}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Mark Complete
                      </Button>
                    </div>
                  )}

                  {/* Rating */}
                  {contract.status === 'completed' && contract.client_rating && (
                    <div className="text-sm text-muted-foreground pt-2 border-t">
                      Client Rating: {'⭐'.repeat(contract.client_rating)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
