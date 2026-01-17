import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Shield, Star } from "lucide-react";
import { useSecurityGuards } from "@/hooks/useSecurityFirm";
import { HireGuardDialog } from "./HireGuardDialog";
import type { SecurityGuard } from "@/types/security";

interface GuardRosterProps {
  firmId: string;
  maxGuards: number;
}

const getSkillBadgeVariant = (level: number) => {
  if (level >= 8) return "default";
  if (level >= 5) return "secondary";
  return "outline";
};

const GuardCard = ({ guard }: { guard: SecurityGuard }) => (
  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <Shield className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="font-medium">{guard.name}</p>
        <p className="text-xs text-muted-foreground">
          {guard.experience_years} years experience
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Badge variant={getSkillBadgeVariant(guard.skill_level)}>
        <Star className="h-3 w-3 mr-1" />
        Level {guard.skill_level}
      </Badge>
      <Badge variant={guard.status === 'active' ? 'default' : 'secondary'}>
        {guard.status}
      </Badge>
      <span className="text-sm text-muted-foreground">
        ${guard.salary_per_event}/event
      </span>
    </div>
  </div>
);

export const GuardRoster = ({ firmId, maxGuards }: GuardRosterProps) => {
  const [showHireDialog, setShowHireDialog] = useState(false);
  const { data: guards = [], isLoading } = useSecurityGuards(firmId);

  const activeGuards = guards.filter(g => g.status === 'active');
  const canHire = activeGuards.length < maxGuards;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Guard Roster</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {activeGuards.length}/{maxGuards} guards
            </span>
            <Button
              size="sm"
              onClick={() => setShowHireDialog(true)}
              disabled={!canHire}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Hire Guard
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-4">Loading guards...</p>
          ) : guards.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground">No guards hired yet</p>
              <p className="text-sm text-muted-foreground">
                Hire guards to fulfill security contracts
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {guards.map((guard) => (
                <GuardCard key={guard.id} guard={guard} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <HireGuardDialog
        open={showHireDialog}
        onOpenChange={setShowHireDialog}
        firmId={firmId}
      />
    </>
  );
};
