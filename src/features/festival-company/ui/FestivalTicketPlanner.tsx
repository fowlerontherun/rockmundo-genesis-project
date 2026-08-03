import { useEffect, useRef, useState } from "react";
import { Calculator, Ticket, WandSparkles } from "lucide-react";
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
import { useFestivalSitePlan } from "../application/useFestivalSitePlan";
import {
  useFestivalTicketPlan,
  useSaveFestivalTicketPlan,
} from "../application/useFestivalTicketPlan";
import {
  formatMinorMoney,
  parseMoneyToMinor,
  ticketPlanToDraft,
  type FestivalTicketPlanDraft,
  type FestivalTicketPlanResult,
  type FestivalTicketProduct,
} from "../domain/festivalTicketPlan";
import { previewTicketForecast } from "../domain/festivalTicketForecast";
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
}: {
  festivalCompanyId: string;
}) {
  const site = useFestivalSitePlan(festivalCompanyId);
  const query = useFestivalTicketPlan(
    festivalCompanyId,
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
          site operations are generated from company upgrades and scale.
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
  const forecast = previewTicketForecast(
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
                <Ticket className="h-5 w-5" /> Standard Festival ticket
              </CardTitle>
              <CardDescription>
                One price and one availability figure. The game handles release
                timing, taxes, fees and demand calculations.
              </CardDescription>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
              Capacity {data.usableSiteCapacity.toLocaleString("en-GB")}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="festival-ticket-price">
              Ticket price ({currency})
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="festival-expected-demand">
              Expected sell-through (%)
            </Label>
            <Input
              id="festival-expected-demand"
              type="number"
              min={0}
              max={100}
              value={Math.round(
                draft.ticketPlan.expectedSellThroughBasisPoints / 100,
              )}
              onChange={(event) => {
                const percentage = Math.min(
                  100,
                  Math.max(0, Number(event.target.value)),
                );
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        ticketPlan: {
                          ...current.ticketPlan,
                          expectedSellThroughBasisPoints: Math.round(
                            percentage * 100,
                          ),
                        },
                      }
                    : current,
                );
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ForecastCard
          title="Expected tickets sold"
          value={forecast.expectedTicketsSold.toLocaleString("en-GB")}
        />
        <ForecastCard
          title="Expected gross sales"
          value={formatMinorMoney(
            forecast.expectedGrossTicketReceiptsMinor,
            currency,
          )}
        />
        <ForecastCard
          title="Estimated tax and refunds"
          value={formatMinorMoney(
            forecast.estimatedTaxMinor + forecast.expectedRefundsMinor,
            currency,
          )}
        />
        <ForecastCard
          title="Expected net ticket income"
          value={formatMinorMoney(
            forecast.expectedNetTicketReceiptsMinor,
            currency,
          )}
        />
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WandSparkles className="h-5 w-5" /> Automatic ticket operations
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>• General-sale timing and availability</p>
          <p>• Booking fees, tax and expected refunds</p>
          <p>• Daily attendance allocation</p>
          <p>• Demand effects from marketing and reputation</p>
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
            ? "Saving…"
            : dirty
              ? "Unsaved ticket choices"
              : data.ready
                ? "Ticket plan ready"
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
            <Calculator className="mr-2 h-4 w-4" /> Confirm ticket plan
          </Button>
        </div>
      </div>
    </section>
  );
}

function ForecastCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-lg font-semibold">{value}</CardContent>
    </Card>
  );
}
