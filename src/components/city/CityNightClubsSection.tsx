import { useEffect, useState } from "react";
import { Disc3, GlassWater, ListMusic, Mic2, Sparkles, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CityNightClub } from "@/utils/worldEnvironment";

interface CityNightClubsSectionProps {
  nightClubs: CityNightClub[];
}

const QUALITY_LABELS: Record<number, string> = {
  1: "Underground",
  2: "Neighborhood",
  3: "Boutique",
  4: "Premier",
  5: "Legendary",
};

const fameFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatCurrencyValue = (value: number | null | undefined): string | null => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return currencyFormatter.format(value);
};

const formatSetLength = (value: number | null | undefined): string | null => {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return null;
  }

  if (value < 60) {
    return `${value} min set`;
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!minutes) {
    return `${hours} hr set`;
  }

  return `${hours} hr ${minutes} min set`;
};

const getQualityLabel = (qualityLevel: number) => QUALITY_LABELS[qualityLevel] ?? `Tier ${qualityLevel}`;

export const CityNightClubsSection = ({ nightClubs }: CityNightClubsSectionProps) => {
  const [selectedSongByClub, setSelectedSongByClub] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelectedSongByClub((previous) => {
      const next: Record<string, string> = {};
      let changed = false;

      nightClubs.forEach((club) => {
        if (!club.djSlot.availableSongs.length) {
          if (previous[club.id]) {
            changed = true;
          }
          return;
        }

        const existingSelection = previous[club.id];
        const hasExisting = existingSelection
          ? club.djSlot.availableSongs.some((song) => song.id === existingSelection)
          : false;
        const fallbackSelection = club.djSlot.availableSongs[0]?.id ?? "";
        const nextSelection = hasExisting ? existingSelection : fallbackSelection;

        if (nextSelection) {
          next[club.id] = nextSelection;
        }

        if (nextSelection !== existingSelection) {
          changed = true;
        }
      });

      const previousKeys = Object.keys(previous);
      const nextKeys = Object.keys(next);
      if (!changed && previousKeys.length === nextKeys.length) {
        const mismatch = previousKeys.some((key) => previous[key] !== next[key]);
        if (!mismatch) {
          return previous;
        }
      }

      return next;
    });
  }, [nightClubs]);

  if (!nightClubs.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Disc3 className="h-5 w-5 text-primary" />
            Night Clubs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            Nightlife information will appear here once clubs have been scouted for this city.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Disc3 className="h-5 w-5 text-primary" />
          Night Clubs & Late Sets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nightClubs.map((club) => {
          const qualityLabel = getQualityLabel(club.qualityLevel);
          const fameRequirementLabel = fameFormatter.format(Math.max(0, club.djSlot.fameRequirement));
          const coverChargeLabel = formatCurrencyValue(club.coverCharge);
          const djPayoutLabel = formatCurrencyValue(club.djSlot.payout ?? null);
          const setLengthLabel = formatSetLength(club.djSlot.setLengthMinutes ?? null);
          const liveInteractionsLabel = club.liveInteractionsEnabled ? "Live interactions enabled" : "Live interactions paused";
          const availableSongs = club.djSlot.availableSongs ?? [];
          const selectedSongId = selectedSongByClub[club.id];
          const selectedSong = selectedSongId
            ? availableSongs.find((song) => song.id === selectedSongId)
            : undefined;
          const hasSongLibrary = availableSongs.length > 0;
          const queueButtonLabel = selectedSong
            ? `Queue with ${selectedSong.title}`
            : "Queue for DJ Slot";

          return (
            <div
              key={club.id}
              className="space-y-4 rounded-lg border border-border/60 p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold leading-tight">{club.name}</h3>
                    <Badge variant="secondary">{qualityLabel}</Badge>
                    <Badge variant={club.liveInteractionsEnabled ? "outline" : "destructive"}>{liveInteractionsLabel}</Badge>
                  </div>
                  {club.description && (
                    <p className="max-w-xl text-sm text-muted-foreground">{club.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      DJ slots require {fameRequirementLabel} fame
                    </span>
                    {club.capacity && (
                      <span>
                        Capacity {club.capacity.toLocaleString()}
                      </span>
                    )}
                    {coverChargeLabel && <span>Cover {coverChargeLabel}</span>}
                    {club.djSlot.schedule && <span>Slots {club.djSlot.schedule}</span>}
                    {djPayoutLabel && <span>Pay {djPayoutLabel}</span>}
                    {setLengthLabel && <span>{setLengthLabel}</span>}
                  </div>
                  {club.djSlot.perks && club.djSlot.perks.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {club.djSlot.perks.map((perk) => (
                        <Badge key={`${club.id}-perk-${perk}`} variant="outline">
                          {perk}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  {hasSongLibrary ? (
                    <div className="flex w-full flex-col gap-1 md:w-[260px]">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Choose your track
                      </span>
                      <Select
                        value={selectedSongId ?? undefined}
                        onValueChange={(value) =>
                          setSelectedSongByClub((prev) => ({
                            ...prev,
                            [club.id]: value,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full text-left">
                          <SelectValue placeholder="Pick a released song" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSongs.map((song) => (
                            <SelectItem key={song.id} value={song.id}>
                              {song.title}
                              {song.genre ? ` · ${song.genre}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="w-full text-xs text-muted-foreground md:text-right">
                      City managers must assign released songs before DJs can perform here.
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full md:w-auto"
                    variant="default"
                    disabled={!hasSongLibrary}
                  >
                    <Mic2 className="mr-2 h-4 w-4" /> {queueButtonLabel}
                  </Button>
                  <Button size="sm" variant="outline" className="w-full md:w-auto">
                    <Sparkles className="mr-2 h-4 w-4" /> Visit as Guest
                  </Button>
                </div>
              </div>

              {club.guestActions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" /> Guest Experiences
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {club.guestActions.map((action) => (
                      <Badge key={action.id} variant="secondary" className="flex items-center gap-1">
                        {action.label}
                        {typeof action.energyCost === "number" && action.energyCost > 0 && (
                          <span className="text-[11px] text-muted-foreground">-{action.energyCost} energy</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                  {club.guestActions.some((action) => action.description) && (
                    <ul className="list-disc space-y-1 pl-6 text-xs text-muted-foreground">
                      {club.guestActions
                        .filter((action) => action.description)
                        .map((action) => (
                          <li key={`${action.id}-description`}>{action.description}</li>
                        ))}
                    </ul>
                  )}
                </div>
              )}

              {club.drinkMenu.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <GlassWater className="h-4 w-4 text-primary" /> Signature Drinks
                  </div>
                  <div className="space-y-2">
                    {club.drinkMenu.map((drink) => (
                      <div key={drink.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{drink.name}</span>
                        {formatCurrencyValue(drink.price) && (
                          <Badge variant="outline">{formatCurrencyValue(drink.price)}</Badge>
                        )}
                        {drink.effect && (
                          <span className="text-xs text-muted-foreground">{drink.effect}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {availableSongs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <ListMusic className="h-4 w-4 text-primary" /> Released Song Library
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableSongs.map((song) => (
                      <Badge key={song.id} variant="outline">
                        {song.title}
                        {song.genre ? ` · ${song.genre}` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {club.npcProfiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Users className="h-4 w-4 text-primary" /> Resident NPCs
                  </div>
                  <div className="space-y-2">
                    {club.npcProfiles.map((npc) => (
                      <div key={npc.id} className="rounded-md border border-border/40 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{npc.name}</span>
                          {npc.role && <Badge variant="outline">{npc.role}</Badge>}
                          {npc.personality && (
                            <span className="text-xs text-muted-foreground">{npc.personality}</span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {npc.availability && <span>On deck: {npc.availability}</span>}
                          {npc.dialogueHooks && npc.dialogueHooks.length > 0 && (
                            <span>
                              Topics: {npc.dialogueHooks.slice(0, 3).join(", ")}
                              {npc.dialogueHooks.length > 3 ? "…" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CityNightClubsSection;
