import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Ticket, WandSparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FestivalBudgetForecast } from "@/features/festivals/budget/FestivalBudgetForecast";
import { festivalRoutes } from "@/features/festivals/routes";
import { useFestivalSitePlan } from "../application/useFestivalSitePlan";
import {
  useFestivalTicketPlan,
  useSaveFestivalTicketPlan,
} from "../application/useFestivalTicketPlan";
import {
  parseMoneyToMinor,
  ticketPlanToDraft,
  type FestivalTicketPlanDraft,
  type FestivalTicketPlanResult,
  type FestivalTicketProduct,
} from "../domain/festivalTicketPlan";
import { validateFestivalTicketDraft } from "../domain/festivalTicketValidation";

const SIMPLE_TICKET_SLUG = "standard-festival-ticket";

function standardTicket(
  dates: string[],
  capacity: number,
): FestivalTicketProduct {
  return {
    id: null,
    name: "Standard Festival Ticket",
    slug: SIMPLE_TICKET_SLUG,
    ticketType: "full_festival",
    productClass: "admission",
    accessScope: "full_festival",
    validFromDate: dates[0],
    validToDate: dates.at(-1)!,
    priceMinor: 0,
    faceValueMinor: 0,
    capacityLimit: capacity,
    minimumAge: null,
    includesCamping: false,
    includesParking: false,
    includesVipArea: false,
    includesBackstage: false,
    transferable: true,
    refundable: false,
    salePriority: 0,
    active: true,
  };
}

function simpleDraftFromResult(
  result: FestivalTicketPlanResult,
): FestivalTicketPlanDraft {
  const existing = ticketPlanToDraft(result);
  const draft: FestivalTicketPlanDraft = existing ?? {
    ticketPlan: {
      id: null,
      currencyCode: "GBP",
      salesTaxRateBasisPoints: 2000,
      bookingFeeMode: "none",
      bookingFeeMinor: 0,
      bookingFeeBasisPoints: 0,
      bookingFeePayer: "customer",
      refundPolicy: "Standard Festival refund policy",
      transferPolicy: "Tickets may be transferred before the Festival starts.",
      minimumPurchaseQuantity: 1,
      maximumPurchaseQuantity: 8,
      expectedSellThroughBasisPoints: 8000,
      expectedRefundBasisPoints: 300,
      expectedComplimentaryUseBasisPoints: 0,
      expectedNoShowBasisPoints: 500,
      status: "in_progress",
    },
    products: [],
    releasePhases: [],
    capacityAllocations: [],
  };

  const admissionIndex = draft.products.findIndex(
    (product) => product.active && product.productClass === "admission",
  );
  const product =
    admissionIndex >= 0
      ? draft.products[admissionIndex]
      : standardTicket(result.festivalDates, result.usableSiteCapacity);
  const products =
    admissionIndex >= 0 ? draft.products : [product, ...draft.products];
  const existingAllocations = new Map(
    draft.capacityAllocations
      .filter((allocation) => allocation.productSlug === product.slug)
      .map((allocation) => [allocation.festivalDate, allocation]),
  );
  const capacityAllocations = [
    ...result.festivalDates.map((festivalDate) => ({
      id: existingAllocations.get(festivalDate)?.id ?? null,
      productId: product.id,
      productSlug: product.slug,
      festivalDate,
      capacityAllocated:
        existingAllocations.get(festivalDate)?.capacityAllocated ??
        product.capacityLimit,
      capacityReserved:
        existingAllocations.get(festivalDate)?.capacityReserved ?? 0,
      capacityComplimentary:
        existingAllocations.get(festivalDate)?.capacityComplimentary ?? 0,
    })),
    ...draft.capacityAllocations.filter(
      (allocation) => allocation.productSlug !== product.slug,
    ),
  ];

  return {
    ...draft,
    products,
    capacityAllocations,
  };
}

export function FestivalTicketPlanner({
  festivalCompanyId,
  festivalEditionId,
}: {
  festivalCompanyId: string;
  festivalEditionId?: string;
}) {
  const site = useFestivalSitePlan(festivalCompanyId, festivalEditionId);
  const query = useFestivalTicketPlan(
    festivalCompanyId,
    festivalEditionId,
    site.data?.ready === true,
  );
  const save = useSaveFestivalTicketPlan();
  const [draft, setDraft] = useState<FestivalTicketPlanDraft | null>(null);
  const retry = useRef<{ hash: string; key: string } | null>(null);

  useEffect(() => {
    if (query.data) setDraft(simpleDraftFromResult(query.data));
  }, [query.data]);

  if (site.isLoading) {
    return <p role="status">Checking Festival readiness…</p>;
  }

  if (!site.data?.ready) {
    return (
      <Alert>
        <AlertDescription>
          Complete the high-level Festival plan before setting tickets. Detailed
          site operations are generated automatically from company upgrades and
          Festival scale.
        </AlertDescription>
      </Alert>
    );
  }

  if (query.isLoading) {
    return <p role="status">Loading ticket choices…</p>;
  }

  if (query.isError || !query.data || !draft) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Ticket choices could not be loaded. Check your company access and try
          again.
        </AlertDescription>
      </Alert>
    );
  }

  const data = query.data;
  const admissionIndex = draft.products.findIndex(
    (product) => product.active && product.productClass === "admission",
  );
  const admission = draft.products[admissionIndex];
  const currency = draft.ticketPlan.currencyCode;
  const issues = validateFestivalTicketDraft(
    draft,
    data.festivalDates,
    data.usableSiteCapacity,
  );
  const savedDraft = simpleDraftFromResult(data);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);

  const updateAdmission = (patch: Partial<FestivalTicketProduct>) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        products: current.products.map((product, index) =>
          index === admissionIndex ? { ...product, ...patch } : product,
        ),
      };
    });
  };

  const updateCapacity = (requested: number) => {
    const capacity = Math.min(
      data.usableSiteCapacity,
      Math.max(0, Math.floor(requested)),
    );
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        products: current.products.map((product, index) =>
          index === admissionIndex
            ? { ...product, capacityLimit: capacity }
            : product,
        ),
        capacityAllocations: current.capacityAllocations.map((allocation) =>
          allocation.productSlug === admission.slug
            ? { ...allocation, capacityAllocated: capacity }
            : allocation,
        ),
      };
    });
  };

  const persist = (complete = false) => {
    if (save.isPending || !data.canWrite) return;
    const hash = JSON.stringify({ draft, complete });
    if (retry.current?.hash !== hash) {
      retry.current = { hash, key: crypto.randomUUID() };
    }
    save.mutate(
      {
        festivalCompanyId,
        festivalEditionId,
        expectedVersion: data.planningVersion,
        draft,
        idempotencyKey: retry.current.key,
        complete,
      },
      {
        onSuccess: (result) => {
          setDraft(simpleDraftFromResult(result));
          retry.current = null;
        },
      },
    );
  };

  return (
    <section className="space-y-5" aria-labelledby="simple-ticket-title">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle id="simple-ticket-title" className="flex items-center gap-2">
                <Ticket className="h-5 w-5" /> Tickets & budget
              </CardTitle>
              <CardDescription>
                Set one standard ticket price and how many tickets to sell. The
                game handles demand, tax, refunds, sponsorship and operating
                costs automatically.
              </CardDescription>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
              Maximum capacity {data.usableSiteCapacity.toLocaleString("en-GB")}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="festival-ticket-price">
              Standard ticket price ({currency})
            </Label>
            <Input
              id="festival-ticket-price"
              inputMode="decimal"
              value={(admission.priceMinor / 100).toFixed(2)}
              onChange={(event) => {
                const amount = parseMoneyToMinor(event.target.value);
                if (amount === null) return;
                updateAdmission({ priceMinor: amount, faceValueMinor: amount });
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="festival-tickets-available">Tickets available</Label>
            <Input
              id="festival-tickets-available"
              type="number"
              min={0}
              max={data.usableSiteCapacity}
              value={admission.capacityLimit}
              onChange={(event) => updateCapacity(Number(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              You can sell fewer tickets than capacity. Demand is recalculated
              by the server after you save.
            </p>
          </div>
        </CardContent>
      </Card>

      {festivalEditionId ? (
        <FestivalBudgetForecast
          festivalCompanyId={festivalCompanyId}
          festivalEditionId={festivalEditionId}
        />
      ) : null}

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WandSparkles className="h-5 w-5" /> Calculated automatically
          </CardTitle>
          <CardDescription>
            The forecast above is the whole Festival result, not just ticket
            sales.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>• Expected attendance and ticket demand</p>
          <p>• Total projected revenue and sponsorship</p>
          <p>• Operating costs, tax and expected refunds</p>
          <p>• Projected Festival profit or loss</p>
        </CardContent>
      </Card>

      {issues.length ? (
        <Alert variant="destructive">
          <AlertDescription>
            {issues.length} ticket blocker(s) remain. Check the price and ensure
            tickets available do not exceed Festival capacity.
          </AlertDescription>
        </Alert>
      ) : null}

      {save.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            Ticket choices could not be saved. {save.error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4">
        <span role="status" className="text-sm text-muted-foreground">
          {save.isPending
            ? "Saving and recalculating Festival forecast…"
            : dirty
              ? "Unsaved ticket choices"
              : data.ready
                ? "Tickets & budget ready"
                : "Ticket choices saved"}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!dirty || save.isPending || !data.canWrite}
            onClick={() => persist(false)}
          >
            Save choices
          </Button>
          <Button
            disabled={issues.length > 0 || save.isPending || !data.canWrite}
            onClick={() => persist(true)}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm tickets & budget
          </Button>
        </div>
      </div>

      {festivalEditionId && data.ready && !dirty ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Tickets & budget complete
            </CardTitle>
            <CardDescription>
              Your price, availability and Festival forecast are saved. Next,
              review launch blockers and run the Festival.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={festivalRoutes.live(festivalCompanyId, festivalEditionId)}>
                Continue to Run Festival
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
