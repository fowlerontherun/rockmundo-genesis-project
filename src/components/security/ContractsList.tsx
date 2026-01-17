import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, Users, DollarSign } from "lucide-react";
import { useSecurityContracts } from "@/hooks/useSecurityFirm";
import type { SecurityContract } from "@/types/security";
import { format } from "date-fns";

interface ContractsListProps {
  firmId: string;
}

const getStatusColor = (status: SecurityContract['status']) => {
  switch (status) {
    case 'active': return 'bg-green-500/10 text-green-500 border-green-500/30';
    case 'accepted': return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
    case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
    case 'completed': return 'bg-muted text-muted-foreground border-muted';
    case 'cancelled': return 'bg-red-500/10 text-red-500 border-red-500/30';
    default: return '';
  }
};

const ContractCard = ({ contract }: { contract: SecurityContract }) => (
  <div className="p-4 border rounded-lg space-y-3">
    <div className="flex items-start justify-between">
      <div>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-medium capitalize">{contract.contract_type} Contract</span>
        </div>
        {contract.notes && (
          <p className="text-sm text-muted-foreground mt-1">{contract.notes}</p>
        )}
      </div>
      <Badge className={getStatusColor(contract.status)}>
        {contract.status}
      </Badge>
    </div>

    <div className="grid grid-cols-3 gap-4 text-sm">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span>{contract.guards_required} guards</span>
      </div>
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <span>${contract.fee_per_event.toLocaleString()}/event</span>
      </div>
      {contract.start_date && (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{format(new Date(contract.start_date), 'MMM d, yyyy')}</span>
        </div>
      )}
    </div>

    {contract.total_fee && (
      <div className="pt-2 border-t">
        <span className="text-sm text-muted-foreground">Total Value: </span>
        <span className="font-semibold">${contract.total_fee.toLocaleString()}</span>
      </div>
    )}
  </div>
);

export const ContractsList = ({ firmId }: ContractsListProps) => {
  const { data: contracts = [], isLoading } = useSecurityContracts(firmId);

  const activeContracts = contracts.filter(c => c.status === 'active' || c.status === 'accepted');
  const pendingContracts = contracts.filter(c => c.status === 'pending');
  const completedContracts = contracts.filter(c => c.status === 'completed');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Security Contracts</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-4">Loading contracts...</p>
        ) : contracts.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">No contracts yet</p>
            <p className="text-sm text-muted-foreground">
              Bands and venues will hire your firm for security
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeContracts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-green-500">
                  Active ({activeContracts.length})
                </h4>
                <div className="space-y-2">
                  {activeContracts.map(contract => (
                    <ContractCard key={contract.id} contract={contract} />
                  ))}
                </div>
              </div>
            )}

            {pendingContracts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-yellow-500">
                  Pending ({pendingContracts.length})
                </h4>
                <div className="space-y-2">
                  {pendingContracts.map(contract => (
                    <ContractCard key={contract.id} contract={contract} />
                  ))}
                </div>
              </div>
            )}

            {completedContracts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                  Completed ({completedContracts.length})
                </h4>
                <div className="space-y-2">
                  {completedContracts.slice(0, 5).map(contract => (
                    <ContractCard key={contract.id} contract={contract} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
