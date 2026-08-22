import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { festivalCompanySetupQueryKey } from "@/features/festival-company/application/useFestivalCompanySetup";
import { getFestivalCompanySetup } from "@/features/festival-company/data/festivalCompanyRepository";
import { FestivalCompanyEligibilityCard } from "@/features/festival-company/ui/FestivalCompanyEligibilityCard";
import { FestivalConfigurationWizard } from "@/features/festival-company/ui/FestivalConfigurationWizard";
import { FestivalUpgradeWorkspace } from "@/features/festival-company/upgrades/FestivalUpgradeWorkspace";
import { FestivalCompanyEditionsPage } from "@/features/festivals/editions/FestivalCompanyEditionsPage";
import { FestivalLiveControlRoom } from "@/features/festivals/runtime/FestivalLiveControlRoom";
import { settlementRepository } from "@/features/festivals/settlement/repository";
import { resolveOwnerFestivalIdentifier, resolvePublicFestivalIdentifier } from "../resolver";
import { festivalRoutes } from "../routes";
import {
  FestivalEditionApplications,
  FestivalEditionFinance,
  FestivalEditionHistory,
  FestivalEditionOverview,
} from "./FestivalEditionSections";

export function FestivalFoundingPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <h1 className="text-3xl font-bold">Found a Festival company</h1>
      <p>
        Start a company-owned annual Festival brand. Eligibility, limits,
        authority, funds and price are verified by the server.
      </p>
      <FestivalCompanyEligibilityCard />
    </main>
  );
}

export function FestivalCompanyHome() {
  const { festivalCompanyId } = useParams();
  const { pathname } = useLocation();

  if (!festivalCompanyId) {
    return (
      <RouteState
        title="Festival company unavailable"
        body="The company route is missing its identifier."
      />
    );
  }

  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === festivalRoutes.editions(festivalCompanyId)) {
    return <FestivalCompanyEditionsPage festivalCompanyId={festivalCompanyId} />;
  }

  return <FestivalCompanySummaryHome festivalCompanyId={festivalCompanyId} />;
}

function FestivalCompanySummaryHome({
  festivalCompanyId,
}: {
  festivalCompanyId: string;
}) {
  const query = useQuery({
    queryKey: festivalCompanySetupQueryKey(festivalCompanyId),
    queryFn: () => getFestivalCompanySetup(festivalCompanyId),
  });

  if (query.isLoading) {
    return (
      <main className="p-6" role="status">
        Loading Festival company…
      </main>
    );
  }

  if (query.error || !query.data) {
    return (
      <RouteState
        title="Festival company unavailable"
        body="The company was not found or you do not have management permission."
      />
    );
  }

  const festival = query.data;

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Company-owned Festival
        </p>
        <h1 className="text-3xl font-bold">{festival.publicName}</h1>
        <p className="max-w-3xl text-muted-foreground">
          Build the company, improve its eleven upgrade areas and run one
          simplified annual Festival. Detailed operational work is calculated by
          the game from your company level and high-impact choices.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Summary title="Company" value={festival.legalCompanyName} />
        <Summary
          title="Company balance"
          value={new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
          }).format(festival.companyBalance)}
        />
        <Summary
          title="Festival setup"
          value={festival.setupCompleted ? "Ready" : "Action required"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Festival company loop</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <strong>1. Fund the company</strong>
            <span className="mt-1 block text-muted-foreground">
              Use normal company banking, ownership and finance.
            </span>
          </p>
          <p>
            <strong>2. Buy upgrades</strong>
            <span className="mt-1 block text-muted-foreground">
              Improve the eleven permanent Festival areas.
            </span>
          </p>
          <p>
            <strong>3. Plan the annual event</strong>
            <span className="mt-1 block text-muted-foreground">
              Choose the line-up, budget, tickets and launch timing.
            </span>
          </p>
          <p>
            <strong>4. Collect the result</strong>
            <span className="mt-1 block text-muted-foreground">
              The game simulates operations, attendance and profit.
            </span>
          </p>
        </CardContent>
      </Card>

      <p>
        {festival.configurationComplete
          ? "The company identity and annual Festival defaults are configured."
          : "Complete the initial company setup to create the first annual Festival."}
      </p>

      <div className="flex flex-wrap gap-3">
        <Link
          className="underline"
          to={festivalRoutes.genericCompany(festival.companyId)}
        >
          Company finances and staff
        </Link>
        {festival.setupCompleted ? (
          <Link
            className="underline"
            to={festivalRoutes.editions(festival.festivalCompanyId)}
          >
            Annual Festivals
          </Link>
        ) : null}
        <Link
          className="underline"
          to={festivalRoutes.upgrades(festival.festivalCompanyId)}
        >
          Festival upgrades
        </Link>
      </div>

      {!festival.setupCompleted ? (
        <section
          className="rounded-lg border p-4 md:p-6"
          aria-label="Initial Festival company setup"
        >
          <FestivalConfigurationWizard festivalCompanyId={festivalCompanyId} />
        </section>
      ) : null}
    </main>
  );
}

export function FestivalUpgradesPage() {
  const { festivalCompanyId } = useParams();
  return <FestivalUpgradeWorkspace festivalCompanyId={festivalCompanyId!} />;
}

const Summary = ({ title, value }: { title: string; value: string }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">{title}</CardTitle>
    </CardHeader>
    <CardContent>{value}</CardContent>
  </Card>
);

export const editionNavigation = [
  { section: "overview", label: "Plan" },
  { section: "applications", label: "Line-up" },
  { section: "finance", label: "Tickets & budget" },
  { section: "live", label: "Run Festival" },
  { section: "history", label: "Results" },
] as const;

type SimplifiedEditionSection = (typeof editionNavigation)[number]["section"];

function editionSectionRoute(
  section: SimplifiedEditionSection,
  festivalCompanyId: string,
  editionId: string,
) {
  switch (section) {
    case "overview":
      return festivalRoutes.edition(festivalCompanyId, editionId);
    case "applications":
      return festivalRoutes.applications(festivalCompanyId, editionId);
    case "finance":
      return festivalRoutes.finance(festivalCompanyId, editionId);
    case "live":
      return festivalRoutes.live(festivalCompanyId, editionId);
    case "history":
      return festivalRoutes.history(festivalCompanyId, editionId);
  }
}

export function FestivalEditionShell() {
  const { festivalCompanyId, editionId } = useParams();
  const { pathname } = useLocation();
  const query = useQuery({
    queryKey: ["festival-owner-resolution", festivalCompanyId, editionId],
    enabled: Boolean(festivalCompanyId && editionId),
    queryFn: () => resolveOwnerFestivalIdentifier(festivalCompanyId!, editionId),
  });

  if (query.isLoading) {
    return (
      <main className="p-6" role="status">
        Resolving annual Festival…
      </main>
    );
  }

  if (query.error) {
    return (
      <RouteState
        title="Festival access denied"
        body="Your active character does not have authority to manage this company-owned Festival."
      />
    );
  }

  if (!query.data || query.data.status !== "resolved") {
    return <ResolutionState status={query.data?.status ?? "not_found"} />;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link className="underline" to={festivalRoutes.company(festivalCompanyId!)}>
          Festival company
        </Link>{" "}
        /{" "}
        <Link className="underline" to={festivalRoutes.editions(festivalCompanyId!)}>
          Annual Festivals
        </Link>{" "}
        / <span>{query.data.editionYear ?? "Current Festival"}</span>
      </nav>

      <header className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Annual company event
        </p>
        <h1 className="text-3xl font-bold">
          Festival {query.data.editionYear ?? ""}
        </h1>
      </header>

      <nav
        className="-mx-1 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Annual Festival navigation"
      >
        {editionNavigation.map(({ section, label }) => {
          const to = editionSectionRoute(
            section,
            festivalCompanyId!,
            editionId!,
          );
          const active = pathname === to;
          return (
            <Link
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              key={section}
              to={to}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <Outlet context={query.data} />
    </main>
  );
}

export function FestivalEditionWorkspace({ section }: { section: string }) {
  const { festivalCompanyId, editionId } = useParams();

  if (!festivalCompanyId || !editionId) {
    return (
      <RouteState
        title="Festival not found"
        body="This annual Festival route is missing its identifiers."
      />
    );
  }

  switch (section) {
    case "overview":
      return (
        <FestivalEditionOverview
          festivalCompanyId={festivalCompanyId}
          editionId={editionId}
        />
      );
    case "applications":
      return (
        <FestivalEditionApplications
          festivalCompanyId={festivalCompanyId}
          editionId={editionId}
        />
      );
    case "finance":
      return (
        <FestivalEditionFinance
          festivalCompanyId={festivalCompanyId}
          editionId={editionId}
        />
      );
    case "live":
      return (
        <FestivalLiveControlRoom
          companyId={festivalCompanyId}
          editionId={editionId}
        />
      );
    case "history":
      return <FestivalEditionHistory editionId={editionId} />;
    case "site":
      return (
        <Navigate
          replace
          to={festivalRoutes.edition(festivalCompanyId, editionId)}
        />
      );
    case "schedule":
    case "contracts":
      return (
        <Navigate
          replace
          to={festivalRoutes.applications(festivalCompanyId, editionId)}
        />
      );
    case "operations":
    case "sponsorship":
    case "launch":
    case "settlement":
      return (
        <Navigate
          replace
          to={festivalRoutes.live(festivalCompanyId, editionId)}
        />
      );
    default:
      return (
        <Navigate
          replace
          to={festivalRoutes.edition(festivalCompanyId, editionId)}
        />
      );
  }
}

export function PublicFestivalEditionPage() {
  const { festivalCompanyIdentifier, editionIdentifier } = useParams();
  const query = useQuery({
    queryKey: [
      "public-festival-resolution",
      festivalCompanyIdentifier,
      editionIdentifier,
    ],
    queryFn: () =>
      resolvePublicFestivalIdentifier(
        festivalCompanyIdentifier!,
        "festival_company",
        editionIdentifier,
      ),
  });

  if (query.isLoading) {
    return (
      <main className="p-6" role="status">
        Resolving Festival…
      </main>
    );
  }

  if (!query.data || query.data.status !== "resolved") {
    return <ResolutionState status={query.data?.status ?? "unavailable"} />;
  }

  return (
    <PublicEditionHistory
      editionId={query.data.editionId!}
      slug={query.data.publicSlug!}
      year={query.data.editionYear}
    />
  );
}

function PublicEditionHistory({
  editionId,
  slug,
  year,
}: {
  editionId: string;
  slug: string;
  year?: number;
}) {
  const query = useQuery({
    queryKey: ["public-festival-history", editionId],
    queryFn: () => settlementRepository.history(editionId),
  });

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <nav aria-label="Breadcrumb">
        <Link to={festivalRoutes.publicCompany(slug)}>Festival company</Link> /
        Annual Festival
      </nav>
      <h1 className="text-3xl font-bold">
        {query.data?.festivalName ?? "Festival"} {year}
      </h1>
      {query.isLoading ? (
        <p role="status">Loading Festival results…</p>
      ) : !query.data ? (
        <p>This Festival has no completed public result yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Summary
            title="Dates"
            value={`${query.data.dates?.startsOn ?? "—"} – ${
              query.data.dates?.endsOn ?? "—"
            }`}
          />
          <Summary
            title="Attendance"
            value={(query.data.attendance ?? 0).toLocaleString("en-GB")}
          />
          <Summary
            title="Audience rating"
            value={`${query.data.audienceScore ?? "—"}/100`}
          />
          <Summary
            title="Result"
            value={query.data.profitabilityBand.replaceAll("_", " ")}
          />
          <Summary
            title="Headliners"
            value={query.data.headliners.map(String).join(", ") || "—"}
          />
          <Summary
            title="Reputation"
            value={`${query.data.reputationChange >= 0 ? "+" : ""}${
              query.data.reputationChange
            }`}
          />
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        This result is frozen after the game automatically completes Festival
        finances and outcomes. Private company figures are not published.
      </p>
    </main>
  );
}

export function LegacyFestivalRedirect({
  target,
}: {
  target: "overview" | "schedule" | "operations";
}) {
  const { festivalId, editionId } = useParams();
  const { search } = useLocation();
  const query = useQuery({
    queryKey: ["legacy-festival-redirect", festivalId, editionId],
    queryFn: () => resolveOwnerFestivalIdentifier(festivalId!, editionId),
  });

  if (query.isLoading) {
    return <main className="p-6">Resolving historical Festival route…</main>;
  }

  if (
    !query.data ||
    query.data.status !== "resolved" ||
    !query.data.festivalCompanyId ||
    !query.data.editionId
  ) {
    return <ResolutionState status={query.data?.status ?? "not_found"} />;
  }

  const destination =
    target === "overview"
      ? festivalRoutes.edition(
          query.data.festivalCompanyId,
          query.data.editionId,
        )
      : target === "schedule"
        ? festivalRoutes.applications(
            query.data.festivalCompanyId,
            query.data.editionId,
          )
        : festivalRoutes.live(
            query.data.festivalCompanyId,
            query.data.editionId,
          );

  return <Navigate replace to={`${destination}${search}`} />;
}

export const RouteState = ({
  title,
  body,
}: {
  title: string;
  body: string;
}) => (
  <main className="mx-auto max-w-2xl p-8">
    <h1 className="text-3xl font-bold">{title}</h1>
    <p className="mt-3">{body}</p>
  </main>
);

export function ResolutionState({ status }: { status: string }) {
  if (status === "legacy_only") {
    return (
      <RouteState
        title="Historical Festival record"
        body="This read-only legacy record has no canonical company mapping. Applications, purchases and management actions are unavailable."
      />
    );
  }
  if (status === "ambiguous") {
    return (
      <RouteState
        title="Festival mapping needs repair"
        body="More than one mapping exists, so the application will not guess a destination."
      />
    );
  }
  if (status === "unavailable") {
    return (
      <RouteState
        title="Festival service unavailable"
        body="Festival resolution is temporarily unavailable."
      />
    );
  }
  return (
    <RouteState
      title="Festival not found"
      body="No Festival matches this identifier."
    />
  );
}

export function LegacyFestivalSetupRedirect() {
  const { festivalCompanyId } = useParams();
  const { search } = useLocation();
  return (
    <Navigate
      replace
      to={`${festivalRoutes.company(festivalCompanyId!)}${search}`}
    />
  );
}
