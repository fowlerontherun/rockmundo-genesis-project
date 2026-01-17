import { ChevronRight, Building2, Disc, Shield, Factory, Building, Music, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Company, CompanyType } from "@/types/company";
import { COMPANY_TYPE_INFO } from "@/types/company";

interface SubsidiaryTreeProps {
  holdingCompany: Company;
  subsidiaries: Company[];
  onCompanyClick?: (company: Company) => void;
  onAddSubsidiary?: () => void;
}

const CompanyTypeIcon = ({ type, className }: { type: CompanyType; className?: string }) => {
  const iconProps = { className: cn("h-4 w-4", className) };
  
  switch (type) {
    case 'holding':
      return <Building2 {...iconProps} />;
    case 'label':
      return <Disc {...iconProps} />;
    case 'security':
      return <Shield {...iconProps} />;
    case 'factory':
      return <Factory {...iconProps} />;
    case 'venue':
      return <Building {...iconProps} />;
    case 'rehearsal':
      return <Music {...iconProps} />;
    default:
      return <Building2 {...iconProps} />;
  }
};

const TreeNode = ({ 
  company, 
  isRoot = false, 
  onClick 
}: { 
  company: Company; 
  isRoot?: boolean; 
  onClick?: () => void;
}) => {
  const typeInfo = COMPANY_TYPE_INFO[company.company_type];
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
        "hover:border-primary/50 hover:bg-accent/50",
        isRoot ? "border-primary/30 bg-primary/5" : "border-border bg-background",
        company.is_bankrupt && "opacity-60 border-destructive/30"
      )}
    >
      <div className={cn(
        "p-2 rounded-lg",
        isRoot ? "bg-primary/20" : "bg-muted",
        typeInfo.color
      )}>
        <CompanyTypeIcon type={company.company_type} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{company.name}</p>
        <p className="text-xs text-muted-foreground">{typeInfo.label}</p>
      </div>
      <Badge 
        variant="outline" 
        className={cn(
          "text-xs",
          company.status === 'active' && "bg-green-500/10 text-green-500 border-green-500/20",
          company.status === 'bankrupt' && "bg-destructive/10 text-destructive border-destructive/20"
        )}
      >
        {company.status}
      </Badge>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
};

export const SubsidiaryTree = ({
  holdingCompany,
  subsidiaries,
  onCompanyClick,
  onAddSubsidiary,
}: SubsidiaryTreeProps) => {
  // Group subsidiaries by type
  const groupedSubsidiaries = subsidiaries.reduce((acc, sub) => {
    const type = sub.company_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(sub);
    return acc;
  }, {} as Record<CompanyType, Company[]>);

  const subsidiaryTypes: CompanyType[] = ['label', 'security', 'factory', 'venue', 'rehearsal'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Corporate Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Holding Company (Root) */}
        <TreeNode 
          company={holdingCompany} 
          isRoot 
          onClick={() => onCompanyClick?.(holdingCompany)} 
        />

        {/* Subsidiaries */}
        <div className="pl-6 border-l-2 border-muted ml-4 space-y-4">
          {subsidiaryTypes.map((type) => {
            const subs = groupedSubsidiaries[type];
            if (!subs || subs.length === 0) return null;

            const typeInfo = COMPANY_TYPE_INFO[type];
            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground pl-2">
                  <CompanyTypeIcon type={type} className={typeInfo.color} />
                  <span>{typeInfo.label}s ({subs.length})</span>
                </div>
                <div className="space-y-2">
                  {subs.map((sub) => (
                    <TreeNode
                      key={sub.id}
                      company={sub}
                      onClick={() => onCompanyClick?.(sub)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Empty state / Add button */}
          {subsidiaries.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm mb-3">No subsidiaries yet</p>
              {onAddSubsidiary && (
                <Button variant="outline" size="sm" onClick={onAddSubsidiary}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Subsidiary
                </Button>
              )}
            </div>
          ) : onAddSubsidiary && (
            <Button variant="ghost" size="sm" className="w-full" onClick={onAddSubsidiary}>
              <Plus className="h-4 w-4 mr-2" />
              Add Subsidiary
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
