import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Users, Star, FileText, Settings } from "lucide-react";
import { SecurityFirm, LICENSE_LEVEL_NAMES, EQUIPMENT_QUALITY_NAMES } from "@/types/security";
import { useSecurityGuards, useSecurityContracts } from "@/hooks/useSecurityFirm";

interface SecurityFirmCardProps {
  firm: SecurityFirm;
  onManage?: () => void;
}

export const SecurityFirmCard = ({ firm, onManage }: SecurityFirmCardProps) => {
  const { data: guards = [] } = useSecurityGuards(firm.id);
  const { data: contracts = [] } = useSecurityContracts(firm.id);

  const activeGuards = guards.filter(g => g.status === 'active').length;
  const activeContracts = contracts.filter(c => c.status === 'active' || c.status === 'accepted').length;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{firm.name}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {LICENSE_LEVEL_NAMES[firm.license_level]} License
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{activeGuards}/{firm.max_guards} Guards</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>{activeContracts} Active Contracts</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <span>Reputation: {firm.reputation}</span>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span>{EQUIPMENT_QUALITY_NAMES[firm.equipment_quality]} Gear</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {firm.total_contracts_completed} contracts completed
        </div>

        {onManage && (
          <Button onClick={onManage} className="w-full" size="sm">
            Manage Security Firm
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
