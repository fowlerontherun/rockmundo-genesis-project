import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { festivalRoutes } from "@/features/festivals/routes";
import {
  useFestivalLaunchPlan,
  useFestivalSalesSummary,
  useFestivalPlayerTicketSalesBreakdown,
  usePublicFestival,
} from "../application/useFestivalLaunch";

const launchedStatuses = new Set([
  "launched",
  "tickets_on_sale",
  "sales_paused",
  "sales_closed",
]);

type OwnerLaunchPlan = { launch?: { launchStatus?: string; publicSlug?: string | null }; launchStatus?: string; publicSlug?: string | null };

type PlayerSalesBreakdown = { source: string; ticketsSold: number; orders: number; uniqueBuyers: number; grossMinor: number; subtotalMinor: number; feeMinor: number; taxMinor: number; byProduct: Array<{productId:string;name:string;ticketsSold:number;orders:number;grossMinor:number}> };

type OwnerSales = {
  ticketsSold?: number;
  grossMinor?: number;
  grossSalesMinor?: number;
  currency?: string;
  orders?: number;
};

/**
 * Read-only pre-event snapshot. The company sales RPC is owner-authorised;
 * the public projection supplies admission-only counts and the announced
 * line-up. Both are scoped to the public edition before they are displayed.
 */
export function FestivalOwnerSalesPreview({
  festivalCompanyId,
  festivalDates,
}: {
  festivalCompanyId: string;
  festivalDates: string[];
}) {
  const launch = useFestivalLaunchPlan(festivalCompanyId);
  const launchPayload = launch.data as OwnerLaunchPlan | undefined;
  const launchInfo = launchPayload?.launch ?? launchPayload;
  const isLaunched = launchedStatuses.has(launchInfo?.launchStatus ?? "");
  const slug = isLaunched ? launchInfo?.publicSlug ?? undefined : undefined;
  const publicFestival = usePublicFestival(slug);
  const sales = useFestivalSalesSummary(isLaunched ? festivalCompanyId : undefined);
  const playerSales = useFestivalPlayerTicketSalesBreakdown(isLaunched ? festivalCompanyId : undefined);
  const current = publicFestival.data;

  // Annual companies can hold old launch records while planning a new year.
  // Never display a previous edition's orders on the new edition screen.
  if (!isLaunched || !slug || !current || !festivalDates.length ||
      current.startsAt.slice(0, 10) !== festivalDates[0]) {
    return null;
  }

  const counts = current.ticketSales;
  const owner = sales.data as OwnerSales | undefined;
  const players = playerSales.data as PlayerSalesBreakdown | undefined;
  const grossMinor = owner?.grossMinor ?? owner?.grossSalesMinor;
  const gross = typeof grossMinor === "number" && Number.isFinite(grossMinor)
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: owner?.currency || "GBP",
      }).format(grossMinor / 100)
    : null;
  const confirmed = current.lineup?.length ?? 0;

  return (
    <Card aria-label="Current Festival ticket sales and confirmed line-up">
      <CardHeader>
        <CardTitle>Live ticket sales &amp; confirmed line-up</CardTitle>
        <CardDescription>
          Your launched Festival's progress before the event. Sales counts are
          actual purchases, not the demand forecast or simulated attendance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {counts ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Paid admissions sold</p>
              <p className="text-2xl font-bold">
                {counts.admissionTicketsSold.toLocaleString("en-GB")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Available admissions</p>
              <p className="text-2xl font-bold">
                {counts.admissionTicketsAvailable.toLocaleString("en-GB")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Admission allocation</p>
              <p className="text-2xl font-bold">
                {counts.admissionTicketAllocation.toLocaleString("en-GB")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confirmed acts</p>
              <p className="text-2xl font-bold">{confirmed.toLocaleString("en-GB")}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            Detailed admission sales are not available for this Festival.
          </p>
        )}
        {sales.isError ? (
          <p className="text-sm text-muted-foreground" role="status">
            Owner-only gross receipts are temporarily unavailable.
          </p>
        ) : gross !== null ? (
          <div className="flex flex-wrap gap-6 rounded-lg bg-muted/40 p-3 text-sm">
            <p><span className="text-muted-foreground">Completed ticket orders: </span>
              <strong>{(owner?.orders ?? 0).toLocaleString("en-GB")}</strong>
            </p>
            <p><span className="text-muted-foreground">Gross ticket receipts: </span>
              <strong>{gross}</strong>
            </p>
          </div>
        ) : null}
        {playerSales.isError ? (
          <p role="status" className="text-sm text-muted-foreground">Player purchase breakdown is temporarily unavailable.</p>
        ) : players ? (
          <section aria-label="Player ticket purchases" className="space-y-3 rounded-lg border p-4">
            <div>
              <h3 className="font-semibold">Real player purchases</h3>
              <p className="text-xs text-muted-foreground">Confirmed purchases only. Forecast attendance and future simulated sales are not included.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <p><span className="block text-xs text-muted-foreground">Tickets purchased</span><strong className="text-xl">{players.ticketsSold.toLocaleString("en-GB")}</strong></p>
              <p><span className="block text-xs text-muted-foreground">Orders</span><strong className="text-xl">{players.orders.toLocaleString("en-GB")}</strong></p>
              <p><span className="block text-xs text-muted-foreground">Unique players</span><strong className="text-xl">{players.uniqueBuyers.toLocaleString("en-GB")}</strong></p>
            </div>
            {players.byProduct?.length > 0 && (
              <div className="space-y-1 border-t pt-3">
                <p className="text-sm font-medium">Sales by ticket type</p>
                {players.byProduct.map((product) => (
                  <div key={product.productId} className="flex justify-between gap-4 text-sm">
                    <span>{product.name}</span>
                    <span>{product.ticketsSold.toLocaleString("en-GB")} sold</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Gross receipts include any booking fees, tax and add-ons. The admission
          counts above exclude add-ons and refunded or cancelled tickets.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to={festivalRoutes.publicCompany(slug)}>
            Preview the complete public line-up
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
