import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Shield, TrendingUp, Star, Settings } from "lucide-react";
import { useSecurityFirm } from "@/hooks/useSecurityFirm";
import { useCompany } from "@/hooks/useCompanies";
import { GuardRoster } from "@/components/security/GuardRoster";
import { ContractsList } from "@/components/security/ContractsList";
import { LICENSE_LEVEL_NAMES, LICENSE_LEVEL_VENUE_CAPACITY, EQUIPMENT_QUALITY_NAMES } from "@/types/security";

const SecurityFirmManagement = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { data: company, isLoading: companyLoading } = useCompany(companyId);
  const { data: firm, isLoading: firmLoading } = useSecurityFirm(companyId);

  if (companyLoading || firmLoading) {
    return (
      <div className="container py-6">
        <p className="text-center text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!company || !firm) {
    return (
      <div className="container py-6">
        <p className="text-center text-muted-foreground">Security firm not found</p>
        <Button onClick={() => navigate(-1)} className="mx-auto mt-4 block">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{firm.name}</h1>
          </div>
          <p className="text-muted-foreground">
            Subsidiary of {company.name}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-1" />
          Settings
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">License Level</p>
                <p className="text-xl font-bold">{LICENSE_LEVEL_NAMES[firm.license_level]}</p>
              </div>
              <Badge variant="outline">Level {firm.license_level}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Up to {LICENSE_LEVEL_VENUE_CAPACITY[firm.license_level].toLocaleString()} capacity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Equipment</p>
                <p className="text-xl font-bold">{EQUIPMENT_QUALITY_NAMES[firm.equipment_quality]}</p>
              </div>
              <Settings className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Quality tier {firm.equipment_quality}/5
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reputation</p>
                <p className="text-xl font-bold">{firm.reputation}</p>
              </div>
              <Star className="h-5 w-5 text-yellow-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Build reputation through successful contracts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-xl font-bold">{firm.total_contracts_completed}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total contracts completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Guard Roster */}
      <GuardRoster firmId={firm.id} maxGuards={firm.max_guards} />

      {/* Contracts */}
      <ContractsList firmId={firm.id} />
    </div>
  );
};

export default SecurityFirmManagement;
