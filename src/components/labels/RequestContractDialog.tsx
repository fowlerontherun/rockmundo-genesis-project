import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import type {
  ArtistEntity,
  DealTypeRow,
  LabelWithRelations,
  TerritoryRow,
} from "./types";

interface RequestContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: LabelWithRelations | null;
  artistEntities: ArtistEntity[];
  dealTypes: DealTypeRow[];
  territories: TerritoryRow[];
}

const DEFAULT_ADVANCE_AMOUNT = 25000;

export function RequestContractDialog({
  open,
  onOpenChange,
  label,
  artistEntities,
  dealTypes,
  territories,
}: RequestContractDialogProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedDealTypeId, setSelectedDealTypeId] = useState<string | null>(null);
  const [selectedRosterSlotId, setSelectedRosterSlotId] = useState<string | null>(null);
  const [artistRoyalty, setArtistRoyalty] = useState<number>(20);
  const [labelRoyalty, setLabelRoyalty] = useState<number>(80);
  const [advanceAmount, setAdvanceAmount] = useState<number>(DEFAULT_ADVANCE_AMOUNT);
  const [termMonths, setTermMonths] = useState<number>(24);
  const [releaseQuota, setReleaseQuota] = useState<number>(3);
  const [requestedStartDate, setRequestedStartDate] = useState<string>("");
  const [selectedTerritories, setSelectedTerritories] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const openRosterSlots = useMemo(() => {
    if (!label?.label_roster_slots) return [];
    return label.label_roster_slots.filter((slot) => slot.status !== "reserved");
  }, [label]);

  const defaultDealType = useMemo(() => dealTypes[0] ?? null, [dealTypes]);

  useEffect(() => {
    if (open) {
      const soloEntity = artistEntities.find((entity) => entity.type === "solo");
      setSelectedEntityId(soloEntity?.id ?? artistEntities[0]?.id ?? null);
      const initialDealType = defaultDealType;
      setSelectedDealTypeId(initialDealType?.id ?? null);
      setArtistRoyalty(initialDealType?.default_artist_royalty ?? 20);
      setLabelRoyalty(initialDealType?.default_label_royalty ?? 80);
      setAdvanceAmount(
        initialDealType?.includes_advance ? DEFAULT_ADVANCE_AMOUNT : 0
      );
      setTermMonths(initialDealType?.default_term_months ?? 24);
      setReleaseQuota(initialDealType?.default_release_quota ?? 3);
      setSelectedRosterSlotId(openRosterSlots[0]?.id ?? null);
      setSelectedTerritories(
        label?.label_territories?.map((item) => item.territory_code) ?? []
      );
      setRequestedStartDate("");
      setNotes("");
    }
  }, [open, artistEntities, defaultDealType, openRosterSlots, label]);

  useEffect(() => {
    if (!selectedDealTypeId) return;
    const currentDeal = dealTypes.find((deal) => deal.id === selectedDealTypeId);
    if (!currentDeal) return;
    setArtistRoyalty(currentDeal.default_artist_royalty ?? 20);
    setLabelRoyalty(currentDeal.default_label_royalty ?? 80);
    setTermMonths(currentDeal.default_term_months ?? 24);
    setReleaseQuota(currentDeal.default_release_quota ?? 3);
    setAdvanceAmount(currentDeal.includes_advance ? DEFAULT_ADVANCE_AMOUNT : 0);
  }, [selectedDealTypeId, dealTypes]);

  const selectedEntity = useMemo(
    () => artistEntities.find((entity) => entity.id === selectedEntityId) ?? null,
    [artistEntities, selectedEntityId]
  );

  const toggleTerritory = (code: string) => {
    setSelectedTerritories((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  const handleArtistRoyaltyChange = (value: number) => {
    const clamped = Math.min(Math.max(value, 0), 100);
    setArtistRoyalty(clamped);
    setLabelRoyalty(Math.max(0, 100 - clamped));
  };

  const handleSubmit = async () => {
    if (!label || !selectedEntity) {
      toast({
        title: "Missing information",
        description: "Select a label and signing entity before submitting a request.",
        variant: "destructive",
      });
      return;
    }

    if (dealTypes.length === 0) {
      toast({
        title: "No deal templates available",
        description: "Ask the label to publish at least one deal type before requesting a contract.",
        variant: "destructive",
      });
      return;
    }

    const totalRoyalty = artistRoyalty + labelRoyalty;
    if (totalRoyalty > 100.0001) {
      toast({
        title: "Invalid royalty split",
        description: "Artist and label royalty percentages cannot exceed 100%.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from("artist_label_contracts").insert({
      label_id: label.id,
      deal_type_id: selectedDealTypeId,
      band_id: selectedEntity.type === "band" ? selectedEntity.id : null,
      artist_profile_id: selectedEntity.type === "solo" ? selectedEntity.id : null,
      roster_slot_id: selectedRosterSlotId,
      royalty_artist_pct: artistRoyalty,
      royalty_label_pct: labelRoyalty,
      advance_amount: advanceAmount,
      term_months: termMonths,
      release_quota: releaseQuota,
      start_date: requestedStartDate || null,
      territories: selectedTerritories,
      notes: notes.trim() || null,
      status: "pending",
      masters_owned_by_artist: dealTypes.find((deal) => deal.id === selectedDealTypeId)?.masters_owned_by_artist ?? false,
    } as any);

    if (error) {
      toast({
        title: "Unable to submit contract",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Notify the label owner about the incoming request
    // (The artist-side notification is handled by the DB trigger)
    if (label) {
      try {
        const { data: labelOwner } = await supabase
          .from("labels")
          .select("owner_id")
          .eq("id", label.id)
          .single();

        if (labelOwner?.owner_id) {
          // owner_id is a profile id, look up user_id
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("id", labelOwner.owner_id)
            .single();

          if (ownerProfile?.user_id) {
            await supabase.from("player_inbox").insert({
              user_id: ownerProfile.user_id,
              category: "record_label" as any,
              priority: "normal" as any,
              title: "📩 Contract Request Received",
              message: `${selectedEntity?.name || "An artist"} has requested a contract with ${label.name}. Review their proposal in your label's contracts tab.`,
              related_entity_type: "contract",
              action_type: "navigate",
              action_data: { path: `/labels/${label.id}/manage` },
            });
          }
        }
      } catch (e) {
        console.error("Failed to notify label owner:", e);
      }
    }

    toast({
      title: "Contract request sent",
      description: "The label has received your proposal and will review it shortly.",
    });

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["labels-directory"] }),
      queryClient.invalidateQueries({ queryKey: ["label-contracts"] }),
    ]);

    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request a contract with {label?.name}</DialogTitle>
          <DialogDescription>
            Negotiate royalty splits, term length, and territory reach before submitting your proposal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Signing entity</Label>
              <Select value={selectedEntityId ?? ""} onValueChange={setSelectedEntityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select band or solo artist" />
                </SelectTrigger>
                <SelectContent>
                  {artistEntities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.name}
                      {entity.type === "band" && entity.genre ? ` · ${entity.genre}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Deal structure</Label>
              <Select value={selectedDealTypeId ?? ""} onValueChange={setSelectedDealTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose deal type" />
                </SelectTrigger>
                <SelectContent>
                  {dealTypes.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>
                      {deal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDealTypeId ? (
                <p className="text-xs text-muted-foreground">
                  {dealTypes.find((deal) => deal.id === selectedDealTypeId)?.description}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="artist-royalty">Artist royalty %</Label>
              <Input
                id="artist-royalty"
                type="number"
                min={0}
                max={100}
                value={artistRoyalty}
                onChange={(event) => handleArtistRoyaltyChange(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label-royalty">Label royalty %</Label>
              <Input id="label-royalty" type="number" value={labelRoyalty} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="advance-amount">Advance amount</Label>
              <Input
                id="advance-amount"
                type="number"
                min={0}
                value={advanceAmount}
                onChange={(event) => setAdvanceAmount(Number(event.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="term-length">Term (months)</Label>
              <Input
                id="term-length"
                type="number"
                min={3}
                value={termMonths}
                onChange={(event) => setTermMonths(Number(event.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="release-quota">Release quota</Label>
              <Input
                id="release-quota"
                type="number"
                min={0}
                value={releaseQuota}
                onChange={(event) => setReleaseQuota(Number(event.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requested-start">Requested start date</Label>
              <Input
                id="requested-start"
                type="date"
                value={requestedStartDate}
                onChange={(event) => setRequestedStartDate(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Roster slot preference</Label>
              <Select
                value={selectedRosterSlotId ?? ""}
                onValueChange={setSelectedRosterSlotId}
                disabled={!openRosterSlots.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All slots reserved" />
                </SelectTrigger>
                <SelectContent>
                  {openRosterSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      Slot {slot.slot_number}
                      {slot.focus_genre ? ` · ${slot.focus_genre}` : ""}
                      {slot.status === "open" ? <Badge className="ml-2">Open</Badge> : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target territories</Label>
              <ScrollArea className="h-32 rounded-md border p-2">
                <div className="space-y-2 text-sm">
                  {territories.map((territory) => (
                    <label key={territory.code} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedTerritories.includes(territory.code)}
                        onCheckedChange={() => toggleTerritory(territory.code)}
                      />
                      <span>
                        {territory.name}
                        {territory.region ? <span className="text-muted-foreground"> · {territory.region}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contract-notes">Negotiation notes</Label>
            <Textarea
              id="contract-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Outline your expectations, marketing commitments, or tour support needs."
            />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
