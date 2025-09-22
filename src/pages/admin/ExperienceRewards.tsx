import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import type { PostgrestError } from "@supabase/supabase-js";

import { AdminRoute } from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { adminAwardSpecialXp } from "@/utils/progression";

import {
  PlayerProfileOption,
  XpGrantFormValues,
  xpGrantDefaultValues,
  xpGrantSchema,
} from "./experienceRewards.helpers";
import { parseString } from "./shared";

export default function ExperienceRewards() {
  const { toast } = useToast();
  const [playerProfiles, setPlayerProfiles] = useState<PlayerProfileOption[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [isAwardingXp, setIsAwardingXp] = useState(false);

  const xpGrantForm = useForm<XpGrantFormValues>({
    resolver: zodResolver(xpGrantSchema),
    defaultValues: xpGrantDefaultValues,
  });

  const targetScope = xpGrantForm.watch("targetScope");
  const selectedProfileIds = xpGrantForm.watch("profileIds");
  const selectedProfileCount = useMemo(
    () => (selectedProfileIds ?? []).length,
    [selectedProfileIds],
  );

  const isRecipientListReady =
    targetScope === "all" || (!isLoadingPlayers && playerProfiles.length > 0);
  const disableXpSubmit = isAwardingXp || !isRecipientListReady;

  useEffect(() => {
    if (targetScope === "single") {
      xpGrantForm.setValue("profileIds", [], {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    } else if (targetScope === "multiple") {
      xpGrantForm.setValue("profileId", undefined, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    } else if (targetScope === "all") {
      xpGrantForm.setValue("profileId", undefined, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
      xpGrantForm.setValue("profileIds", [], {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [targetScope, xpGrantForm]);

  const fetchPlayerProfiles = useCallback(async () => {
    setIsLoadingPlayers(true);
    try {
      const { data, error } = await supabase
        .from("public_profiles")
        .select("id, user_id, display_name, username")
        .order("display_name", { ascending: true, nullsFirst: false })
        .order("username", { ascending: true, nullsFirst: false })
        .limit(500);

      let profileRows = data;
      if (error) {
        if ((error as PostgrestError | null)?.code === "PGRST205") {
          console.warn("public_profiles view unavailable, falling back to profiles table", error);

          const { data: fallbackData, error: fallbackError } = await supabase
            .from("profiles")
            .select("id, user_id, display_name, username")
            .order("display_name", { ascending: true, nullsFirst: false })
            .order("username", { ascending: true, nullsFirst: false })
            .limit(500);

          if (fallbackError) throw fallbackError;
          profileRows = fallbackData;
        } else {
          throw error;
        }
      }

      const profiles = (profileRows ?? [])
        .filter((row): row is {
          id: string;
          user_id: string;
          display_name: string | null;
          username: string | null;
        } => {
          return typeof row?.id === "string" && typeof row?.user_id === "string";
        })
        .map((row) => ({
          profileId: row.id,
          userId: row.user_id,
          displayName: parseString(row.display_name) ?? null,
          username: parseString(row.username) ?? null,
        }))
        .sort((a, b) => {
          const nameA = a.displayName ?? a.username ?? a.profileId;
          const nameB = b.displayName ?? b.username ?? b.profileId;
          return nameA.localeCompare(nameB);
        });

      setPlayerProfiles(profiles);
    } catch (error) {
      console.error("Failed to load player profiles", error);
      toast({
        variant: "destructive",
        title: "Unable to load players",
        description: "We couldn't fetch player profiles. Please try again later.",
      });
    } finally {
      setIsLoadingPlayers(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchPlayerProfiles();
  }, [fetchPlayerProfiles]);

  const handleAwardXpGrant = useCallback(
    async (values: XpGrantFormValues) => {
      setIsAwardingXp(true);
      try {
        const profileIds =
          values.targetScope === "single"
            ? values.profileId
              ? [values.profileId]
              : []
            : values.targetScope === "multiple"
              ? values.profileIds ?? []
              : [];

        const response = await adminAwardSpecialXp({
          amount: values.amount,
          reason: values.reason,
          profileIds,
          applyToAll: values.targetScope === "all",
          metadata: { source: "admin_panel" },
        });

        const awardedCount =
          typeof response.result === "object" &&
          response.result !== null &&
          "awarded_count" in response.result
            ? Number((response.result as Record<string, unknown>).awarded_count)
            : values.targetScope === "all"
              ? playerProfiles.length
              : profileIds.length;

        toast({
          title: "XP granted",
          description:
            response.message ??
            `Granted ${values.amount} XP to ${awardedCount} player${awardedCount === 1 ? "" : "s"}.`,
        });

        xpGrantForm.reset({
          targetScope: values.targetScope,
          profileId: undefined,
          profileIds: [],
          amount: values.amount,
          reason: values.reason,
        });
      } catch (error) {
        console.error("Failed to award XP", error);
        toast({
          variant: "destructive",
          title: "Unable to award XP",
          description: error instanceof Error ? error.message : "Something went wrong while granting XP.",
        });
      } finally {
        setIsAwardingXp(false);
      }
    },
    [toast, xpGrantForm, playerProfiles.length],
  );

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Experience Rewards</h1>
          <p className="text-muted-foreground">
            Grant instant XP bonuses to individual players or the entire community.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-xl">XP Grant</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void fetchPlayerProfiles()}
                disabled={isLoadingPlayers}
              >
                {isLoadingPlayers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh players
              </Button>
            </div>
            <CardDescription>
              Select recipients and provide a reason to award special XP.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...xpGrantForm}>
              <form onSubmit={xpGrantForm.handleSubmit(handleAwardXpGrant)} className="space-y-6">
                <FormField
                  control={xpGrantForm.control}
                  name="targetScope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipients</FormLabel>
                      <FormDescription>Select who should receive the XP award.</FormDescription>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid gap-3 md:grid-cols-3"
                        >
                          <div
                            className={`rounded-md border p-3 transition ${field.value === "single" ? "border-primary" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="single" id="xp-grant-single" />
                              <Label htmlFor="xp-grant-single" className="font-medium">
                                Single player
                              </Label>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Grant XP to one selected player profile.
                            </p>
                          </div>
                          <div
                            className={`rounded-md border p-3 transition ${field.value === "multiple" ? "border-primary" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="multiple" id="xp-grant-multiple" />
                              <Label htmlFor="xp-grant-multiple" className="font-medium">
                                Multiple players
                              </Label>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Select a custom list of players to receive the bonus.
                            </p>
                          </div>
                          <div
                            className={`rounded-md border p-3 transition ${field.value === "all" ? "border-primary" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="all" id="xp-grant-all" />
                              <Label htmlFor="xp-grant-all" className="font-medium">
                                All players
                              </Label>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Everyone with a player profile receives the reward.
                            </p>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {targetScope === "single" ? (
                  <FormField
                    control={xpGrantForm.control}
                    name="profileId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Player</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ?? ""}
                            onValueChange={(value) => {
                              if (value.startsWith("__")) {
                                return;
                              }
                              field.onChange(value);
                            }}
                            disabled={isLoadingPlayers || playerProfiles.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  isLoadingPlayers ? "Loading players..." : "Select a player"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {isLoadingPlayers ? (
                                <SelectItem value="__loading" disabled>
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading players...
                                  </div>
                                </SelectItem>
                              ) : playerProfiles.length === 0 ? (
                                <SelectItem value="__empty" disabled>
                                  No player profiles found.
                                </SelectItem>
                              ) : (
                                playerProfiles.map((player) => {
                                  const id = player.profileId;
                                  return (
                                    <SelectItem key={id} value={id}>
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium">
                                          {player.displayName ?? player.username ?? id}
                                        </span>
                                        {player.displayName && player.username ? (
                                          <span className="text-xs text-muted-foreground">
                                            {player.username}
                                          </span>
                                        ) : null}
                                      </div>
                                    </SelectItem>
                                  );
                                })
                              )}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                {targetScope === "multiple" ? (
                  <FormField
                    control={xpGrantForm.control}
                    name="profileIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Players</FormLabel>
                        <FormDescription>Select each player that should receive XP.</FormDescription>
                        <FormControl>
                          <div className="rounded-md border">
                            <ScrollArea className="max-h-64">
                              <div className="flex flex-col gap-2 p-2">
                                {isLoadingPlayers ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading players...
                                  </div>
                                ) : playerProfiles.length === 0 ? (
                                  <div className="text-sm text-muted-foreground">
                                    No player profiles found.
                                  </div>
                                ) : (
                                  (() => {
                                    const currentSelection = new Set(field.value ?? []);
                                    return playerProfiles.map((player) => {
                                      const id = player.profileId;
                                      const isChecked = currentSelection.has(id);
                                      return (
                                        <label
                                          key={id}
                                          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
                                        >
                                          <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={(checked) => {
                                              const next = new Set(field.value ?? []);
                                              if (checked === true) {
                                                next.add(id);
                                              } else {
                                                next.delete(id);
                                              }
                                              field.onChange(Array.from(next));
                                            }}
                                          />
                                          <div className="flex flex-col">
                                            <span className="text-sm font-medium">
                                              {player.displayName ?? player.username ?? id}
                                            </span>
                                            {player.displayName && player.username ? (
                                              <span className="text-xs text-muted-foreground">
                                                {player.username}
                                              </span>
                                            ) : null}
                                          </div>
                                        </label>
                                      );
                                    });
                                  })()
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                {targetScope === "all" ? (
                  <div className="rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
                    {isLoadingPlayers
                      ? "Loading player roster..."
                      : playerProfiles.length > 0
                        ? `This will grant XP to all ${playerProfiles.length} player${playerProfiles.length === 1 ? "" : "s"}.`
                        : "This will grant XP to every player profile currently in the world."}
                  </div>
                ) : null}

                <div className="grid gap-6 md:grid-cols-[minmax(0,200px)_1fr]">
                  <FormField
                    control={xpGrantForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>XP amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            step={50}
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormDescription>Each recipient receives this amount of XP.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={xpGrantForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            placeholder="Explain why the XP is being granted"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          This message appears in the player notification so they know why they were rewarded.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {targetScope === "multiple" ? (
                    <p className="text-sm text-muted-foreground">
                      Selected {selectedProfileCount} player{selectedProfileCount === 1 ? "" : "s"}.
                    </p>
                  ) : null}
                  <Button type="submit" disabled={disableXpSubmit}>
                    {isAwardingXp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isAwardingXp ? "Granting XP" : "Award XP"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
}
