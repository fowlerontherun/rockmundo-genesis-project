import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  CircleArrowRight,
  Settings,
  Tent,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  festivalCompanyEditionsQueryKey,
  getFestivalCompanyEditions,
} from "@/features/festivals/editions/repository";
import { festivalRoutes } from "@/features/festivals/routes";
import { useFestivalArtistProgramme } from "../application/useFestivalArtistProgramme";
import { useFestivalTicketPlan } from "../application/useFestivalTicketPlan";
import type { OwnedFestivalCompanySummary } from "../data/festivalCompanyRepository";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);

export const festivalCompanyNeedsSetup = (
  festival: Pick<
    OwnedFestivalCompanySummary,
    "setupCompleted" | "firstEditionExists"
  >,
) => !festival.setupCompleted || !festival.firstEditionExists;

export const FestivalCompanyCard = ({
  festival,
}: {
  festival: OwnedFestivalCompanySummary;
}) => {
  const navigate = useNavigate();
  // The replacement flow treats setupCompleted + an annual edition as the
  // authoritative unlock. configurationComplete is retained for display and
  // compatibility, but must not trap an already-created Festival in setup if
  // an older RPC reports a legacy configuration status.
  const needsSetup = festivalCompanyNeedsSetup(festival);

  const editionsQuery = useQuery({
    queryKey: festivalCompanyEditionsQueryKey(festival.festivalCompanyId),
    queryFn: () => getFestivalCompanyEditions(festival.festivalCompanyId),
    enabled: festival.managementEnabled && festival.setupCompleted,
  });

  const currentEdition =
    editionsQuery.data?.editions
      .filter((edition) => edition.editable)
      .sort((left, right) => left.editionYear - right.editionYear)[0] ?? null;
  const annualPlanReady = Boolean(
    currentEdition?.planningStatus === "ready" && currentEdition.planBindings.site,
  );

  const artistQuery = useFestivalArtistProgramme(
    festival.festivalCompanyId,
    currentEdition?.festivalEditionId,
    annualPlanReady,
  );
  const ticketQuery = useFestivalTicketPlan(
    festival.festivalCompanyId,
    currentEdition?.festivalEditionId,
    annualPlanReady,
  );

  let actionLabel = "Open Festival dashboard";
  let actionDescription = "Manage the Festival company and annual event.";
  let actionPath = festivalRoutes.company(festival.festivalCompanyId);

  if (!festival.managementEnabled) {
    actionLabel = "Management unavailable";
    actionDescription = "Festival management is currently unavailable.";
  } else if (needsSetup) {
    actionLabel = "Continue setup";
    actionDescription = "Next: finish the permanent Festival company setup.";
  } else if (editionsQuery.isLoading) {
    actionDescription = "Checking the current annual Festival…";
  } else if (editionsQuery.isError) {
    actionDescription =
      "The current annual Festival could not be checked. Open the dashboard to retry.";
  } else if (!currentEdition) {
    actionLabel = editionsQuery.data?.canPlanNext
      ? "Plan next annual Festival"
      : "View annual Festivals";
    actionDescription = editionsQuery.data?.canPlanNext
      ? "Next: create the company's next annual Festival."
      : "Review the company's Festival history and annual event status.";
    actionPath = festivalRoutes.editions(festival.festivalCompanyId);
  } else if (!annualPlanReady) {
    actionLabel = "Continue Plan";
    actionDescription = `Next: finish the ${currentEdition.editionYear} Festival plan.`;
    actionPath = festivalRoutes.edition(
      festival.festivalCompanyId,
      currentEdition.festivalEditionId,
    );
  } else if (artistQuery.isLoading || ticketQuery.isLoading) {
    actionLabel = "Open current Festival";
    actionDescription = `Checking ${currentEdition.editionYear} line-up and ticket readiness…`;
    actionPath = festivalRoutes.edition(
      festival.festivalCompanyId,
      currentEdition.festivalEditionId,
    );
  } else if (artistQuery.isError || ticketQuery.isError) {
    actionLabel = "Open current Festival";
    actionDescription =
      "Some readiness checks are unavailable. Open the Festival to review them.";
    actionPath = festivalRoutes.edition(
      festival.festivalCompanyId,
      currentEdition.festivalEditionId,
    );
  } else if (!artistQuery.data?.ready) {
    actionLabel = "Continue Line-up";
    actionDescription = `Next: finish the ${currentEdition.editionYear} line-up and confirmed acts.`;
    actionPath = festivalRoutes.applications(
      festival.festivalCompanyId,
      currentEdition.festivalEditionId,
    );
  } else if (!ticketQuery.data?.ready) {
    actionLabel = "Set tickets & budget";
    actionDescription = `Next: finish ticket price, availability and budget for ${currentEdition.editionYear}.`;
    actionPath = festivalRoutes.finance(
      festival.festivalCompanyId,
      currentEdition.festivalEditionId,
    );
  } else {
    actionLabel = "Run Festival";
    actionDescription = `${currentEdition.editionYear} planning, line-up and tickets are ready. Review launch blockers and run the Festival.`;
    actionPath = festivalRoutes.live(
      festival.festivalCompanyId,
      currentEdition.festivalEditionId,
    );
  }

  return (
    <Card data-testid={`festival-company-${festival.festivalCompanyId}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tent className="h-5 w-5 text-fuchsia-500" />
              {festival.publicName}
            </CardTitle>
            <CardDescription>{festival.legalCompanyName}</CardDescription>
          </div>
          <Badge variant={festival.setupCompleted ? "secondary" : "outline"}>
            {festival.setupStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Company balance</div>
            <div className="font-semibold">
              {formatCurrency(festival.companyBalance)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Configuration</div>
            <div className="font-semibold">
              {festival.setupCompleted && festival.firstEditionExists
                ? "Complete"
                : festival.configurationComplete
                  ? "Complete"
                  : "Incomplete"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Setup {festival.setupCompleted ? "complete" : "needed"}
          </div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" />
            {currentEdition
              ? `${currentEdition.editionYear} · ${currentEdition.readinessScore}% ready`
              : `First edition ${festival.firstEditionExists ? "created" : "not created"}`}
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <CircleArrowRight className="h-4 w-4" /> Owner next action
          </p>
          <p className="mt-1 text-muted-foreground">{actionDescription}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            disabled={!festival.managementEnabled}
            onClick={() =>
              navigate(festivalRoutes.company(festival.festivalCompanyId))
            }
          >
            Owner dashboard
          </Button>
          <Button
            disabled={!festival.managementEnabled}
            onClick={() => navigate(actionPath)}
          >
            {actionLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
