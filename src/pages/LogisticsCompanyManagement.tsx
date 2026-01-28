import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Truck, Users, FileText, Wrench } from "lucide-react";
import { useLogisticsCompanies } from "@/hooks/useLogisticsBusiness";
import { VipGate } from "@/components/company/VipGate";
import { LogisticsFleetManager, LogisticsDriversManager, LogisticsContractsManager, LogisticsUpgradesManager } from "@/components/logistics-business";
import { LICENSE_TIER_NAMES, LICENSE_TIER_FLEET_LIMITS, LICENSE_TIER_OPERATING_RADIUS } from "@/types/logistics-business";

export default function LogisticsCompanyManagement() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  
  const { data: companies, isLoading } = useLogisticsCompanies();
  const company = companies?.find(c => c.id === companyId || c.company_id === companyId);
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }
  
  if (!company) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Truck className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Logistics Company Not Found</h2>
          <p className="text-muted-foreground mb-4">The logistics company you're looking for doesn't exist.</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }
  
  return (
    <VipGate feature="Logistics Company" description="Manage your transport fleet, hire drivers, and fulfill logistics contracts.">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6" />
              {company.name}
            </h1>
            <p className="text-muted-foreground">
              {company.specializations?.[0]?.replace('_', ' ') || 'General'} • {LICENSE_TIER_NAMES[company.license_tier]}
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Fleet Capacity</p>
              <p className="text-xl font-bold">{LICENSE_TIER_FLEET_LIMITS[company.license_tier]}</p>
              <p className="text-xs text-muted-foreground mt-1">max vehicles</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">License Tier</p>
              <p className="text-xl font-bold">{company.license_tier}</p>
              <p className="text-xs text-muted-foreground mt-1">tier level</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Operating Radius</p>
              <p className="text-xl font-bold">{LICENSE_TIER_OPERATING_RADIUS[company.license_tier]}</p>
              <p className="text-xs text-muted-foreground mt-1">km range</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Reputation</p>
              <p className="text-xl font-bold">{company.reputation}/100</p>
              <p className="text-xs text-muted-foreground mt-1">reliability score</p>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="fleet" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="fleet" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Fleet</span>
            </TabsTrigger>
            <TabsTrigger value="drivers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Drivers</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Contracts</span>
            </TabsTrigger>
            <TabsTrigger value="upgrades" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Upgrades</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="fleet">
            <LogisticsFleetManager logisticsCompanyId={company.id} fleetCapacity={LICENSE_TIER_FLEET_LIMITS[company.license_tier]} />
          </TabsContent>
          
          <TabsContent value="drivers">
            <LogisticsDriversManager logisticsCompanyId={company.id} />
          </TabsContent>
          
          <TabsContent value="contracts">
            <LogisticsContractsManager logisticsCompanyId={company.id} />
          </TabsContent>
          
          <TabsContent value="upgrades">
            <LogisticsUpgradesManager logisticsCompanyId={company.id} />
          </TabsContent>
        </Tabs>
      </div>
    </VipGate>
  );
}
