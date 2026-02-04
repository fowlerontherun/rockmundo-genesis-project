import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Disc, Shield, Factory, Building, Music, Users, DollarSign, MapPin, AlertTriangle, Truck, Wallet, Mic2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import type { Company, CompanyType } from "@/types/company";
import { COMPANY_TYPE_INFO } from "@/types/company";
import { CompanyFinanceDialog } from "./CompanyFinanceDialog";

interface CompanyCardProps {
  company: Company;
  showActions?: boolean;
  onClick?: () => void;
}

const CompanyTypeIcon = ({ type }: { type: CompanyType }) => {
  const iconProps = { className: "h-5 w-5" };
  
  switch (type) {
    case 'holding':
      return <Building2 {...iconProps} />;
    case 'label':
      return <Disc {...iconProps} />;
    case 'security':
      return <Shield {...iconProps} />;
    case 'factory':
      return <Factory {...iconProps} />;
    case 'logistics':
      return <Truck {...iconProps} />;
    case 'venue':
      return <Building {...iconProps} />;
    case 'rehearsal':
      return <Music {...iconProps} />;
    case 'recording_studio':
      return <Mic2 {...iconProps} />;
    default:
      return <Building2 {...iconProps} />;
  }
};

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Active</Badge>;
    case 'suspended':
      return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Suspended</Badge>;
    case 'bankrupt':
      return <Badge variant="destructive">Bankrupt</Badge>;
    case 'dissolved':
      return <Badge variant="secondary">Dissolved</Badge>;
    default:
      return null;
  }
};

// Smart navigation based on company type
const getManageRoute = (company: Company): string => {
  switch (company.company_type) {
    case 'security':
      return `/security-firm/${company.id}`;
    case 'factory':
      return `/merch-factory/${company.id}`;
    case 'logistics':
      return `/logistics-company/${company.id}`;
    case 'venue':
      return `/venue-business/${company.id}`;
    case 'rehearsal':
      return `/rehearsal-studio-business/${company.id}`;
    case 'recording_studio':
      return `/recording-studio-business/${company.id}`;
    case 'label':
      return `/labels/${company.id}/manage`; // Navigate to dedicated label management page
    default:
      return `/company/${company.id}`;
  }
};

export const CompanyCard = ({ company, showActions = true, onClick }: CompanyCardProps) => {
  const navigate = useNavigate();
  const [financeDialogOpen, setFinanceDialogOpen] = useState(false);
  const typeInfo = COMPANY_TYPE_INFO[company.company_type];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card 
      className={`group transition-all duration-200 hover:border-primary/50 ${onClick ? 'cursor-pointer' : ''} ${company.is_bankrupt ? 'opacity-75 border-destructive/30' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${typeInfo.color}`}>
              <CompanyTypeIcon type={company.company_type} />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {company.name}
                {company.is_bankrupt && (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
              </CardTitle>
              <CardDescription>{typeInfo.label}</CardDescription>
            </div>
          </div>
          <StatusBadge status={company.status} />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {company.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {company.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <span className={company.balance < 0 ? 'text-destructive' : 'text-foreground'}>
              {formatCurrency(company.balance)}
            </span>
          </div>
          
          {company.headquarters_city && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{company.headquarters_city.name}</span>
            </div>
          )}

          {company.employee_count !== undefined && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{company.employee_count} employees</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            Founded {formatDistanceToNow(new Date(company.founded_at), { addSuffix: true })}
          </div>
        </div>

        {company.parent_company && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Subsidiary of <span className="text-foreground">{company.parent_company.name}</span>
            </p>
          </div>
        )}

        {showActions && (
          <div className="pt-2 flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setFinanceDialogOpen(true);
              }}
            >
              <Wallet className="h-4 w-4 mr-1" />
              Finance
            </Button>
            <Button 
              size="sm" 
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                navigate(getManageRoute(company));
              }}
            >
              Manage
            </Button>
          </div>
        )}
        
        {/* Finance Dialog */}
        <CompanyFinanceDialog
          open={financeDialogOpen}
          onOpenChange={setFinanceDialogOpen}
          companyId={company.id}
          companyName={company.name}
        />
      </CardContent>
    </Card>
  );
};
