import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Globe2, Layers, ShieldCheck, Disc3, Album, DollarSign, XCircle, Send, AlertTriangle, Clock, Calendar } from "lucide-react";
import type { ArtistEntity, ContractWithRelations } from "./types";
import { ContractNotificationsPanel } from "./ContractNotificationsPanel";
import { buildContractNotifications } from "./contractNotifications";
import { SubmitDemoDialog } from "./SubmitDemoDialog";
import { DemoSubmissionsPanel } from "./DemoSubmissionsPanel";
import { ContractOfferCard } from "./ContractOfferCard";
import { TerminateContractDialog } from "./TerminateContractDialog";
import { differenceInMonths, differenceInDays, format } from "date-fns";

interface MyContractsTabProps {
  artistEntities: ArtistEntity[];
  userId: string;
}

const STATUS_VARIANTS: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
  pending: "secondary",
  offered: "secondary",
  active: "default",
  completed: "outline",
  terminated: "destructive",
};

function getObligationStatus(completed: number, quota: number, monthsLeft: number, totalMonths: number) {
  if (quota === 0) return 'on-track';
  const progress = completed / quota;
  const timeProgress = 1 - (monthsLeft / totalMonths);
  if (progress >= 1) return 'on-track';
  if (progress >= timeProgress - 0.1) return 'on-track';
  if (progress >= timeProgress - 0.3) return 'behind';
  return 'overdue';
}

const statusColors = {
  'on-track': 'text-green-600',
  'behind': 'text-amber-500',
  'overdue': 'text-destructive',
};

const statusBadge = {
  'on-track': { variant: 'outline' as const, className: 'bg-green-500/10 text-green-700 border-green-500/30' },
  'behind': { variant: 'outline' as const, className: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  'overdue': { variant: 'destructive' as const, className: '' },
};

export function MyContractsTab({ artistEntities, userId }: MyContractsTabProps) {
  const [showDemoDialog, setShowDemoDialog] = useState(false);
  const [terminateContract, setTerminateContract] = useState<any>(null);

  const soloEntity = artistEntities.find((entity) => entity.type === "solo");
  const bandEntities = artistEntities.filter((entity) => entity.type === "band");
  const primaryBandId = bandEntities[0]?.id ?? null;

  const { data: balances } = useQuery({
    queryKey: ["balances-for-termination", userId, primaryBandId],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", userId)
        .single();

      let bandBalance = 0;
      if (primaryBandId) {
        const { data: band } = await supabase
          .from("bands")
          .select("band_balance")
          .eq("id", primaryBandId)
          .single();
        bandBalance = band?.band_balance ?? 0;
      }

      return {
        userBalance: profile?.cash ?? 0,
        bandBalance,
      };
    },
  });

  const { data: contracts, isLoading } = useQuery<ContractWithRelations[]>({
    queryKey: ["label-contracts", soloEntity?.id, bandEntities.map((band) => band.id).join(",")],
    queryFn: async () => {
      const filters: string[] = [];
      if (soloEntity?.id) {
        filters.push(`artist_profile_id.eq.${soloEntity.id}`);
      }
      if (bandEntities.length > 0) {
        const bandFilter = bandEntities.map((band) => `"${band.id}"`).join(",");
        filters.push(`band_id.in.(${bandFilter})`);
      }

      if (filters.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from("artist_label_contracts")
        .select(`
          *,
          labels(id, name, reputation_score),
          label_roster_slots(id, slot_number, status),
          label_releases(id),
          label_royalty_statements(id)
        `)
        .or(filters.join(","))
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data as ContractWithRelations[];
    },
  });

  // Fetch contract offers (status = 'offered')
  const { data: contractOffers = [] } = useQuery({
    queryKey: ["contract-offers", soloEntity?.id, primaryBandId],
    queryFn: async () => {
      const filters: string[] = [];
      if (soloEntity?.id) {
        filters.push(`artist_profile_id.eq.${soloEntity.id}`);
      }
      if (primaryBandId) {
        filters.push(`band_id.eq.${primaryBandId}`);
      }

      if (filters.length === 0) return [];

      const query = supabase
        .from("artist_label_contracts")
        .select(`
          id,
          label_id,
          advance_amount,
          royalty_artist_pct,
          royalty_label_pct,
          single_quota,
          album_quota,
          termination_fee_pct,
          manufacturing_covered,
          territories,
          created_at,
          expires_at,
          demo_submission_id,
          labels(name, reputation_score),
          demo_submissions(songs(title, quality_score))
        `)
        .eq("status", "offered")
        .or(filters.join(",")) as any;

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((offer: any) => ({
        id: offer.id,
        label_id: offer.label_id,
        label_name: offer.labels?.name ?? "Unknown Label",
        label_reputation: offer.labels?.reputation_score ?? 0,
        advance_amount: offer.advance_amount ?? 0,
        royalty_artist_pct: offer.royalty_artist_pct ?? 15,
        royalty_label_pct: offer.royalty_label_pct ?? 85,
        single_quota: offer.single_quota ?? 0,
        album_quota: offer.album_quota ?? 0,
        term_months: 24,
        termination_fee_pct: offer.termination_fee_pct ?? 50,
        manufacturing_covered: offer.manufacturing_covered ?? true,
        territories: offer.territories ?? [],
        demo_song_title: offer.demo_submissions?.songs?.title ?? "Demo",
        demo_song_quality: offer.demo_submissions?.songs?.quality_score ?? 0,
        created_at: offer.created_at,
        expires_at: offer.expires_at,
      }));
    },
  });

  const entityLookup = useMemo(() => {
    const map = new Map<string, ArtistEntity>();
    artistEntities.forEach((entity) => map.set(entity.id, entity));
    return map;
  }, [artistEntities]);

  const { playerMessages, adminAlerts } = useMemo(
    () => buildContractNotifications(contracts ?? [], entityLookup),
    [contracts, entityLookup],
  );

  const activeContracts = contracts?.filter(c => c.status === "active") ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Loading your label contracts...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Submit Demo Button */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Want a Record Deal?</h3>
            <p className="text-sm text-muted-foreground">
              Submit a demo to a label and they may offer you a contract
            </p>
          </div>
          <Button onClick={() => setShowDemoDialog(true)}>
            <Send className="h-4 w-4 mr-2" />
            Submit Demo
          </Button>
        </CardContent>
      </Card>

      {/* Demo Submissions Panel */}
      <DemoSubmissionsPanel userId={userId} bandId={primaryBandId} />

      {/* Contract Offers - Prominent Section */}
      {contractOffers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Contract Offers</h2>
            <Badge variant="destructive" className="animate-pulse">
              {contractOffers.length} pending
            </Badge>
          </div>
          {contractOffers.map((offer) => (
            <div key={offer.id} id={`offer-${offer.id}`} className="transition-all duration-300 rounded-lg">
              <ContractOfferCard
                offer={offer}
                entityName={primaryBandId ? bandEntities[0]?.name ?? "Your Band" : soloEntity?.name ?? "You"}
              />
            </div>
          ))}
        </div>
      )}

      <ContractNotificationsPanel
        playerMessages={playerMessages}
        adminAlerts={adminAlerts}
        onNotificationAction={(notification) => {
          // For offered/pending contracts, scroll to the offer card or contract card
          const targetId = `contract-${notification.contractId}`;
          const offerTarget = `offer-${notification.contractId}`;
          const el = document.getElementById(offerTarget) || document.getElementById(targetId);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-2", "ring-primary", "ring-offset-2");
            setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2000);
          }
        }}
      />

      {/* No contracts message */}
      {(!contracts || contracts.length === 0) && contractOffers.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No label contracts yet. Submit a demo to get noticed by labels!
          </CardContent>
        </Card>
      )}

      {/* Active Contracts with Obligations Dashboard */}
      {activeContracts.map((contract) => {
        const entity = contract.band_id
          ? entityLookup.get(contract.band_id)
          : entityLookup.get(contract.artist_profile_id ?? "");
        const label = contract.labels;
        const advanceAmount = contract.advance_amount ?? 0;
        const recouped = contract.recouped_amount ?? 0;
        const recoupProgress = advanceAmount > 0 ? Math.min((recouped / advanceAmount) * 100, 100) : 100;
        
        const singleQuota = (contract as any).single_quota ?? contract.release_quota ?? 0;
        const albumQuota = (contract as any).album_quota ?? 0;
        const singlesCompleted = (contract as any).singles_completed ?? 0;
        const albumsCompleted = (contract as any).albums_completed ?? 0;
        const territoryList = contract.territories ?? [];

        // Calculate time remaining
        const now = new Date();
        const endDate = contract.end_date ? new Date(contract.end_date) : null;
        const startDate = contract.start_date ? new Date(contract.start_date) : null;
        const monthsLeft = endDate ? Math.max(0, differenceInMonths(endDate, now)) : 0;
        const daysLeft = endDate ? Math.max(0, differenceInDays(endDate, now)) : 0;
        const totalMonths = startDate && endDate ? Math.max(1, differenceInMonths(endDate, startDate)) : 24;

        const singleStatus = getObligationStatus(singlesCompleted, singleQuota, monthsLeft, totalMonths);
        const albumStatus = getObligationStatus(albumsCompleted, albumQuota, monthsLeft, totalMonths);

        return (
          <Card key={contract.id} id={`contract-${contract.id}`} className="transition-all duration-300 rounded-lg">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">
                  {entity ? `${entity.name}` : "Unassigned entity"} · {label?.name ?? "Unknown label"}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">Reputation {label?.reputation_score ?? 0}</Badge>
                  <Badge variant={STATUS_VARIANTS[contract.status ?? "pending"] ?? "secondary"}>
                    {contract.status}
                  </Badge>
                  {(contract as any).manufacturing_covered && (
                    <Badge variant="secondary">Label Pays Manufacturing</Badge>
                  )}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Royalty split: {contract.royalty_artist_pct}% artist / {contract.royalty_label_pct ?? (100 - contract.royalty_artist_pct)}% label
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Obligations Summary - Plain English */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Your Obligations
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      <strong>{monthsLeft > 0 ? `${monthsLeft} month${monthsLeft !== 1 ? 's' : ''}` : `${daysLeft} days`}</strong> remaining
                      {endDate && <span className="text-muted-foreground"> (ends {format(endDate, 'MMM d, yyyy')})</span>}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Disc3 className="h-4 w-4 text-muted-foreground" />
                    <span>
                      <strong>{singlesCompleted}</strong> of <strong>{singleQuota}</strong> singles delivered
                      {singleQuota - singlesCompleted > 0 && (
                        <span className={statusColors[singleStatus]}> — {singleQuota - singlesCompleted} remaining</span>
                      )}
                    </span>
                    {singleStatus !== 'on-track' && (
                      <Badge {...statusBadge[singleStatus]} className={statusBadge[singleStatus].className + ' text-xs'}>
                        {singleStatus === 'behind' ? 'Behind' : 'Overdue'}
                      </Badge>
                    )}
                  </div>

                  {albumQuota > 0 && (
                    <div className="flex items-center gap-2">
                      <Album className="h-4 w-4 text-muted-foreground" />
                      <span>
                        <strong>{albumsCompleted}</strong> of <strong>{albumQuota}</strong> albums delivered
                        {albumQuota - albumsCompleted > 0 && (
                          <span className={statusColors[albumStatus]}> — {albumQuota - albumsCompleted} remaining</span>
                        )}
                      </span>
                      {albumStatus !== 'on-track' && (
                        <Badge {...statusBadge[albumStatus]} className={statusBadge[albumStatus].className + ' text-xs'}>
                          {albumStatus === 'behind' ? 'Behind' : 'Overdue'}
                        </Badge>
                      )}
                    </div>
                  )}

                  {advanceAmount > 0 && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {recoupProgress >= 100 ? (
                          <span className="text-green-600 font-medium">Advance fully recouped! You now earn your full royalty split.</span>
                        ) : (
                          <>
                            Recouped ${recouped.toLocaleString()} of ${advanceAmount.toLocaleString()} advance.
                            <span className="text-muted-foreground"> Royalties go to the label until recouped.</span>
                          </>
                        )}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Progress Bars */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Recoupment */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4" /> Recoupment
                  </div>
                  <Progress value={recoupProgress} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>${recouped.toLocaleString()}</span>
                    <span>${advanceAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* Singles Quota */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Disc3 className="h-4 w-4" /> Singles
                  </div>
                  <Progress value={singleQuota > 0 ? Math.min((singlesCompleted / singleQuota) * 100, 100) : 100} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{singlesCompleted} delivered</span>
                    <span>{singleQuota} required</span>
                  </div>
                </div>

                {/* Albums Quota */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Album className="h-4 w-4" /> Albums
                  </div>
                  <Progress value={albumQuota > 0 ? Math.min((albumsCompleted / albumQuota) * 100, 100) : 100} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{albumsCompleted} delivered</span>
                    <span>{albumQuota} required</span>
                  </div>
                </div>

                {/* Territories */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Globe2 className="h-4 w-4" /> Territories
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {territoryList.length ? (
                      territoryList.slice(0, 3).map((territory) => (
                        <Badge key={territory} variant="secondary" className="text-xs">
                          {territory}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">Global rights</span>
                    )}
                    {territoryList.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{territoryList.length - 3}</Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">Contract Status</div>
                  <div className="text-muted-foreground">
                    {contract.label_releases && contract.label_releases.length > 0
                      ? `${contract.label_releases.length} release${contract.label_releases.length === 1 ? "" : "s"} in pipeline`
                      : "No releases yet"}
                  </div>
                </div>
                
                {contract.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setTerminateContract({
                      id: contract.id,
                      label_name: label?.name ?? "Unknown",
                      advance_amount: advanceAmount,
                      recouped_amount: recouped,
                      single_quota: singleQuota,
                      album_quota: albumQuota,
                      singles_completed: singlesCompleted,
                      albums_completed: albumsCompleted,
                      termination_fee_pct: (contract as any).termination_fee_pct ?? 50,
                      contract_value: (contract as any).contract_value ?? advanceAmount,
                      start_date: contract.start_date,
                      end_date: contract.end_date,
                      band_id: contract.band_id,
                    })}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Terminate Contract
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Submit Demo Dialog */}
      <SubmitDemoDialog
        open={showDemoDialog}
        onOpenChange={setShowDemoDialog}
        userId={userId}
        bandId={primaryBandId}
      />

      {/* Terminate Contract Dialog */}
      {terminateContract && (
        <TerminateContractDialog
          open={!!terminateContract}
          onOpenChange={(open) => !open && setTerminateContract(null)}
          contract={terminateContract}
          bandBalance={balances?.bandBalance}
          userBalance={balances?.userBalance}
        />
      )}
    </div>
  );
}