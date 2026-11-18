import { FestivalPoster } from "@/components/game-art/GameArtwork";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listPublicFestivalEditions } from "@/features/festivals/service";
import { festivalRoutes } from "@/features/festivals/routes";
import { festivalBookingKeys } from "../bookingTypes";
import { getFestivalApplicationAvailability } from "../festivalHubState";
import { useFestivalBookingRealtime } from "../b7CollaborationVoting";
import {
  useFestivalApplicationActions,
  useFestivalApplications,
  useFestivalContracts,
  useFestivalOffers,
} from "../hooks";
import type { PublicFestivalEdition } from "../domainTypes";
import {
  formatBookingDateTime,
  formatBookingMoney,
  editionCurrency,
} from "../formatting";
import { createStableMutationIdempotencyKey } from "../useStableMutationIdempotencyKey";
import { ApplicationStatusCard } from "./ApplicationStatusCard";
import { ContractWorkspace } from "./ContractWorkspace";
import { FestivalApplicationDialog } from "./FestivalApplicationDialog";
import {
  FestivalFanVoting,
  FestivalGuestCollaborationInvitations,
} from "./FestivalB7Panels";
import { FestivalDirectInvitations } from "./FestivalDirectInvitations";
import { FestivalSetlistEditorCanonical } from "./FestivalSetlistEditor";
import { OfferRevisionCard } from "./OfferRevisionCard";

function FestivalReadState({
  label,
  loading,
  failed,
  retry,
  children,
}: {
  label: string;
  loading: boolean;
  failed: boolean;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading) return <p role="status">Loading {label}…</p>;
  if (failed) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">
        <p>Could not load {label}. This does not mean there are no records.</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={retry}>
          Retry {label}
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}

export function CanonicalPlayerFestivalHub({ bandId }: { bandId?: string }) {
  const [applyEdition, setApplyEdition] =
    useState<PublicFestivalEdition | null>(null);
  useFestivalBookingRealtime(`player-${bandId ?? "all"}`);
  const editions = useQuery({
    queryKey: festivalBookingKeys.publicEditions,
    queryFn: listPublicFestivalEditions,
  });
  const applications = useFestivalApplications(bandId);
  const offers = useFestivalOffers(bandId);
  const contracts = useFestivalContracts(bandId);
  const { withdrawApplication } = useFestivalApplicationActions(bandId);
  const allEditions =
    (editions.data as PublicFestivalEdition[] | undefined) ?? [];
  const visibleEditions = useMemo(
    () =>
      allEditions.filter((e) =>
        [
          "accepting_applications",
          "booking",
          "announced",
          "on_sale",
          "preparing",
          "live",
          "completed",
        ].includes(e.status ?? ""),
      ),
    [allEditions],
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div>
          <h2 className="text-xl font-semibold">Festival artist centre</h2>
          <p className="text-sm text-muted-foreground">
            Discover editions, manage invitations and applications, then prepare for your show.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={festivalRoutes.publicDirectory()}>Attend festivals and tickets</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/festivals/history">Festival history</Link>
          </Button>
        </div>
      </header>
      {!bandId && (
        <p role="status" className="rounded-lg border border-amber-500/40 p-3 text-sm">
          Select a band to apply, review offers or prepare a festival setlist.
        </p>
      )}
      <Tabs defaultValue="discover">
        <div className="-mx-1 overflow-x-auto px-1 pb-2" role="region" aria-label="Festival artist navigation" tabIndex={0}>
          <TabsList className="flex h-auto w-max min-w-full justify-start gap-1">

          <TabsTrigger className="min-h-11 shrink-0 whitespace-nowrap" value="discover">Discover</TabsTrigger>
          <TabsTrigger className="min-h-11 shrink-0 whitespace-nowrap" value="applications">My Applications</TabsTrigger>
          <TabsTrigger className="min-h-11 shrink-0 whitespace-nowrap" value="invitations">Invitations</TabsTrigger>
          <TabsTrigger className="min-h-11 shrink-0 whitespace-nowrap" value="fan-voting">Fan Voting</TabsTrigger>
          <TabsTrigger className="min-h-11 shrink-0 whitespace-nowrap" value="offers">Offers</TabsTrigger>
          <TabsTrigger className="min-h-11 shrink-0 whitespace-nowrap" value="contracts">Contracts</TabsTrigger>
          <TabsTrigger className="min-h-11 shrink-0 whitespace-nowrap" value="prep">Preparation</TabsTrigger>
          <TabsTrigger className="min-h-11 shrink-0 whitespace-nowrap" value="history">History</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="discover">
          <FestivalReadState label="festivals" loading={editions.isLoading} failed={editions.isError} retry={() => void editions.refetch()}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleEditions.length ? (
            visibleEditions.map((edition) => {
              const availability = getFestivalApplicationAvailability(edition, bandId);
              return <Card key={edition.id}>
                <FestivalPoster
                  id={edition.id}
                  title={edition.title ?? edition.festival_name ?? "Festival edition"}
                  location={edition.city_name ?? edition.city?.name ?? "City TBA"}
                  date={formatBookingDateTime(edition.start_at)}
                  status={edition.status}
                />
                <CardContent className="space-y-2 pt-4 text-sm">
                  <p>
                    Capacity{" "}
                    {edition.capacity ?? edition.expected_attendance ?? "TBD"} ·
                    tickets{" "}
                    {formatBookingMoney(
                      edition.minimum_ticket_price_cents,
                      editionCurrency(edition),
                    )}
                    –
                    {formatBookingMoney(
                      edition.maximum_ticket_price_cents,
                      editionCurrency(edition),
                    )}
                  </p>
                  <p>Status: {(edition.status ?? "unconfirmed").replaceAll("_", " ")}</p>
                  <Button
                    size="sm"
                    disabled={!availability.canApply}
                    title={availability.reason}
                    onClick={() => setApplyEdition(edition)}
                  >
                    {availability.canApply ? "Apply to perform" : "Applications unavailable"}
                  </Button>
                  {!availability.canApply && <p className="text-xs text-muted-foreground">{availability.reason}</p>}
                </CardContent>
              </Card>;
            })
          ) : (
            <p>No canonical festivals are currently available.</p>
          )}
            </div>
          </FestivalReadState>
        </TabsContent>
        <TabsContent value="applications" className="space-y-3">
          <FestivalReadState label="applications" loading={applications.isLoading} failed={applications.isError} retry={() => void applications.refetch()}>
          {(applications.data ?? []).length ? (
            (applications.data ?? []).map((a) => (
              <ApplicationStatusCard
                key={a.id}
                application={a}
                onWithdraw={(reason) =>
                  withdrawApplication.mutate(
                    {
                      applicationId: a.id,
                      reason,
                      idempotencyKey: createStableMutationIdempotencyKey(
                        "withdraw-application",
                        a.id,
                      ),
                    },
                    { onSuccess: () => toast.success("Application withdrawn") },
                  )
                }
              />
            ))
          ) : (
            <p>{bandId ? "No applications yet." : "Select a band to view applications."}</p>
          )}
          </FestivalReadState>
        </TabsContent>
        <TabsContent value="invitations" className="space-y-4">
          <FestivalDirectInvitations bandId={bandId} editions={allEditions} />
          <FestivalGuestCollaborationInvitations />
        </TabsContent>
        <TabsContent value="fan-voting" className="space-y-3">
          <FestivalFanVoting />
        </TabsContent>
        <TabsContent value="offers" className="space-y-3">
          <FestivalReadState label="offers" loading={offers.isLoading} failed={offers.isError} retry={() => void offers.refetch()}>
          {(offers.data ?? []).length ? (
            (offers.data ?? []).map((offer) => (
              <OfferRevisionCard key={offer.id} offer={offer} />
            ))
          ) : (
            <p>{bandId ? "No offers yet." : "Select a band to view offers."}</p>
          )}
          </FestivalReadState>
        </TabsContent>
        <TabsContent value="contracts" className="space-y-3">
          <FestivalReadState label="contracts" loading={contracts.isLoading} failed={contracts.isError} retry={() => void contracts.refetch()}>
          {(contracts.data ?? []).length ? (
            (contracts.data ?? []).map((c) => (
              <ContractWorkspace key={c.id} contract={c} />
            ))
          ) : (
            <p>{bandId ? "No contracts yet." : "Select a band to view contracts."}</p>
          )}
          </FestivalReadState>
        </TabsContent>
        <TabsContent value="prep" className="space-y-3">
          <FestivalReadState label="contracts" loading={contracts.isLoading} failed={contracts.isError} retry={() => void contracts.refetch()}>
          {(contracts.data ?? []).filter((c) => c.status === "active")
            .length ? (
            (contracts.data ?? [])
              .filter((c) => c.status === "active")
              .map((c) => (
                <FestivalSetlistEditorCanonical key={c.id} contract={c} />
              ))
          ) : (
            <p>Preparation unlocks after a contract is active.</p>
          )}
          </FestivalReadState>
        </TabsContent>
        <TabsContent value="history">
          <p className="text-sm text-muted-foreground">
            Legacy performance history remains available separately until
            canonical performance sessions are introduced.
          </p>
        </TabsContent>
      </Tabs>
      <FestivalApplicationDialog
        edition={applyEdition}
        bandId={bandId}
        open={Boolean(applyEdition)}
        onOpenChange={(open) => !open && setApplyEdition(null)}
      />
    </div>
  );
}
