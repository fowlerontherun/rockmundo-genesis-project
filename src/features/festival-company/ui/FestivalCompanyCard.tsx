import { useNavigate } from "react-router-dom";
import { CalendarCheck, Settings, Tent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OwnedFestivalCompanySummary } from "../data/festivalCompanyRepository";

const formatCurrency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

export const FestivalCompanyCard = ({ festival }: { festival: OwnedFestivalCompanySummary }) => {
  const navigate = useNavigate();
  const needsSetup = !festival.setupCompleted || !festival.configurationComplete || !festival.firstEditionExists;
  const actionLabel = !festival.managementEnabled ? "Management unavailable" : needsSetup ? "Continue setup" : "View festival company";
  const actionPath = needsSetup ? `/companies/festivals/${festival.festivalCompanyId}/setup` : `/companies/festivals/${festival.festivalCompanyId}`;

  return (
    <Card data-testid={`festival-company-${festival.festivalCompanyId}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Tent className="h-5 w-5 text-fuchsia-500" />{festival.publicName}</CardTitle>
            <CardDescription>{festival.legalCompanyName}</CardDescription>
          </div>
          <Badge variant={festival.setupCompleted ? "secondary" : "outline"}>{festival.setupStatus}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-muted-foreground">Company balance</div><div className="font-semibold">{formatCurrency(festival.companyBalance)}</div></div>
          <div><div className="text-muted-foreground">Configuration</div><div className="font-semibold">{festival.configurationComplete ? "Complete" : "Incomplete"}</div></div>
          <div className="flex items-center gap-2"><Settings className="h-4 w-4" />Setup {festival.setupCompleted ? "complete" : "needed"}</div>
          <div className="flex items-center gap-2"><CalendarCheck className="h-4 w-4" />First edition {festival.firstEditionExists ? "created" : "not created"}</div>
        </div>
        <Button className="w-full" disabled={!festival.managementEnabled} onClick={() => navigate(actionPath)}>{actionLabel}</Button>
      </CardContent>
    </Card>
  );
};
