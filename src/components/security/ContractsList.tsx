import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { FileText, Calendar, Users, DollarSign } from"lucide-react";
import { useSecurityContracts } from"@/hooks/useSecurityFirm";
import type { SecurityContract } from"@/types/security";
import { format } from"date-fns";
import { ContentCard, type ContentCardBadge } from"@/components/ui/ContentCard";

interface ContractsListProps {
 firmId: string;
}

const statusTone = (status: SecurityContract["status"]): ContentCardBadge["tone"] => {
 switch (status) {
 case"active":
 return"success";
 case"accepted":
 return"info";
 case"pending":
 return"warning";
 case"completed":
 return"muted";
 case"cancelled":
 return"danger";
 default:
 return"muted";
 }
};

const ContractCard = ({ contract }: { contract: SecurityContract }) => (
 <ContentCard
 title={`${contract.contract_type.charAt(0).toUpperCase()}${contract.contract_type.slice(1)} Contract`}
 subtitle={contract.notes ?? undefined}
 icon={FileText}
 badges={[{ label: contract.status, tone: statusTone(contract.status) }]}
 trailing={
 contract.total_fee ? (
 <div>
 <div className="text-[11px] tracking-wide text-muted-foreground">
 Total
 </div>
 <div className="font-semibold">${contract.total_fee.toLocaleString()}</div>
 </div>
 ) : undefined
 }
 density="compact">
 <div className="grid grid-cols-3 gap-3 text-xs sm:text-sm text-muted-foreground">
 <div className="flex items-center gap-1.5">
 <Users className="h-3.5 w-3.5"/>
 <span>{contract.guards_required} guards</span>
 </div>
 <div className="flex items-center gap-1.5">
 <DollarSign className="h-3.5 w-3.5"/>
 <span>${contract.fee_per_event.toLocaleString()}/event</span>
 </div>
 {contract.start_date && (
 <div className="flex items-center gap-1.5">
 <Calendar className="h-3.5 w-3.5"/>
 <span>{format(new Date(contract.start_date),"MMM d, yyyy")}</span>
 </div>
 )}
 </div>
 </ContentCard>
);

export const ContractsList = ({ firmId }: ContractsListProps) => {
 const { data: contracts = [], isLoading } = useSecurityContracts(firmId);

 const activeContracts = contracts.filter(c => c.status ==='active'|| c.status ==='accepted');
 const pendingContracts = contracts.filter(c => c.status ==='pending');
 const completedContracts = contracts.filter(c => c.status ==='completed');

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
 <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2"/>
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
