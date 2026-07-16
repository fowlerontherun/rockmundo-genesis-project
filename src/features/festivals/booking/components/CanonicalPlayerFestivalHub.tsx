import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listPublicFestivalEditions } from "@/features/festivals/service";
import { festivalBookingKeys } from "../bookingTypes";
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
import { FestivalSetlistEditorCanonical } from "./FestivalSetlistEditor";
import { OfferRevisionCard } from "./OfferRevisionCard";
export function CanonicalPlayerFestivalHub({ bandId }: { bandId?: string }) {
  const [applyEdition, setApplyEdition] =
    useState<PublicFestivalEdition | null>(null);
  const editions = useQuery({
    queryKey: festivalBookingKeys.publicEditions,
    queryFn: listPublicFestivalEditions,
  });
  const applications = useFestivalApplications(bandId);
  const offers = useFestivalOffers(bandId);
  const contracts = useFestivalContracts(bandId);
  const { withdrawApplication } = useFestivalApplicationActions(bandId);
  const visibleEditions = useMemo(
    () =>
      ((editions.data as PublicFestivalEdition[] | undefined) ?? []).filter(
        (e) =>
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
    [editions.data],
  );
  return (
    <div className="space-y-4">
      <Tabs defaultValue="discover">
        <TabsList className="grid h-auto grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="applications">My Applications</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="prep">Preparation</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent
          value="discover"
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
        >
          {editions.isLoading ? (
            <p>Loading festivals…</p>
          ) : visibleEditions.length ? (
            visibleEditions.map((edition) => (
              <Card key={edition.id}>
                <CardHeader>
                  <CardTitle>
                    {edition.title ??
                      edition.festival_name ??
                      "Festival edition"}
                  </CardTitle>
                  <CardDescription>
                    {edition.city_name ?? edition.city?.name ?? "City TBA"} ·{" "}
                    {formatBookingDateTime(edition.start_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
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
                  <p>Status: {edition.status}</p>
                  <Button size="sm" onClick={() => setApplyEdition(edition)}>
                    Apply
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <p>No canonical festivals are currently available.</p>
          )}
        </TabsContent>
        <TabsContent value="applications" className="space-y-3">
          {applications.isLoading ? (
            <p>Loading applications…</p>
          ) : (applications.data ?? []).length ? (
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
            <p>No applications yet.</p>
          )}
        </TabsContent>
        <TabsContent value="offers" className="space-y-3">
          {(offers.data ?? []).length ? (
            (offers.data ?? []).map((offer) => (
              <OfferRevisionCard key={offer.id} offer={offer} />
            ))
          ) : (
            <p>No offers yet.</p>
          )}
        </TabsContent>
        <TabsContent value="contracts" className="space-y-3">
          {(contracts.data ?? []).length ? (
            (contracts.data ?? []).map((c) => (
              <ContractWorkspace key={c.id} contract={c} />
            ))
          ) : (
            <p>No contracts yet.</p>
          )}
        </TabsContent>
        <TabsContent value="prep" className="space-y-3">
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
