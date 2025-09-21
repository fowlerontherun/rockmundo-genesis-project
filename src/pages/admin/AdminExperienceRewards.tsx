import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { adminAwardSpecialXp } from "@/utils/progression";

const xpGrantSchema = z
  .object({
    targetScope: z.enum(["single", "multiple", "all"]),
    profileId: z.string().uuid().optional(),
    profileIds: z.array(z.string().uuid()).optional(),
    amount: z
      .coerce
      .number({ invalid_type_error: "Amount must be a number" })
      .min(1, "XP amount must be at least 1"),
    reason: z.string().min(1, "Please provide a reason for the XP grant"),
  })
  .superRefine((values, ctx) => {
    if (values.targetScope === "single" && !values.profileId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["profileId"],
        message: "Select a player to grant XP.",
      });
    }

    if (values.targetScope === "multiple") {
      const ids = values.profileIds ?? [];
      if (ids.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["profileIds"],
          message: "Select at least one player.",
        });
      }
    }
  });

type XpGrantFormValues = z.infer<typeof xpGrantSchema>;

type PlayerProfileOption = {
  profileId: string;
  userId: string;
  displayName: string | null;
  username: string | null;
};

const parseString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const AdminExperienceRewards = () => {
  const { toast } = useToast();
  const [playerProfiles, setPlayerProfiles] = useState<PlayerProfileOption[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [isAwardingXp, setIsAwardingXp] = useState(false);

  const xpGrantForm = useForm<XpGrantFormValues>({
    resolver: zodResolver(xpGrantSchema),
    defaultValues: {
      targetScope: "single",
      profileId: undefined,
      profileIds: [],
      amount: 100,
      reason: "",
    },
  });

  const targetScope = xpGrantForm.watch("targetScope");
  const selectedProfileIds = xpGrantForm.watch("profileIds");
  const selectedProfileCount = (selectedProfileIds ?? []).length;
  const isRecipientListReady = targetScope === "all" || (!isLoadingPlayers && playerProfiles.length > 0);
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

      if (error) throw error;

      const profiles = (data ?? [])
        .filter((row): row is { id: string; user_id: string; display_name: string | null; username: string | null } => {
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
        description: "We couldn't load the list of player profiles. Please try again.",
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

  const playerCountSummary = useMemo(() => {
    if (targetScope === "all") {
      if (isLoadingPlayers) {
        return "Loading player roster...";
      }

      return playerProfiles.length > 0
        ? `This will grant XP to all ${playerProfiles.length} player${playerProfiles.length === 1 ? "" : "s"}.`
        : "This will grant XP to every player profile currently in the world.";
    }

    return null;
  }, [targetScope, isLoadingPlayers, playerProfiles.length]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Experience Rewards</h1>
        <p className="text-muted-foreground">
          Grant instant XP bonuses to individual players or the entire community.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle>Grant Experience</CardTitle>
              <CardDescription>Configure the recipients and amount of the XP reward.</CardDescription>
            </div>
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
                      <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 md:grid-cols-3">
                        <div className={`rounded-md border p-3 transition ${field.value === "single" ? "border-primary" : ""}`}>
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
                        <div className={`rounded-md border p-3 transition ${field.value === "multiple" ? "border-primary" : ""}`}>
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
                        <div className={`rounded-md border p-3 transition ${field.value === "all" ? "border-primary" : ""}`}>
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
                      <FormDescription>Select the player profile that should receive the XP grant.</FormDescription>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid gap-3 md:grid-cols-2"
                        >
                          {isLoadingPlayers ? (
                            <div className="md:col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" /> Loading players...
                            </div>
                          ) : playerProfiles.length === 0 ? (
                            <p className="md:col-span-2 text-sm text-muted-foreground">
                              No player profiles available.
                            </p>
                          ) : (
                            playerProfiles.map((player) => (
                              <div
                                key={player.profileId}
                                className={`rounded-md border p-3 transition ${field.value === player.profileId ? "border-primary" : ""}`}
                              >
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem value={player.profileId} id={`player-${player.profileId}`} />
                                  <Label htmlFor={`player-${player.profileId}`} className="font-medium">
                                    {player.displayName ?? player.username ?? player.profileId}
                                  </Label>
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {player.username ? `@${player.username}` : player.userId}
                                </p>
                              </div>
                            ))
                          )}
                        </RadioGroup>
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
                      <FormLabel>Player selection</FormLabel>
                      <FormDescription>Choose the players who should receive the XP grant.</FormDescription>
                      <FormControl>
                        <div className="rounded-md border">
                          <ScrollArea className="h-64">
                            <div className="space-y-2 p-3">
                              {isLoadingPlayers ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" /> Loading players...
                                </div>
                              ) : playerProfiles.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No player profiles available.</p>
                              ) : (
                                playerProfiles.map((player) => {
                                  const id = player.profileId;
                                  const checked = field.value?.includes(id) ?? false;
                                  return (
                                    <label
                                      key={id}
                                      className={`flex items-center gap-3 rounded-md border p-3 transition ${checked ? "border-primary bg-primary/5" : "border-border"}`}
                                    >
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(next) => {
                                          const current = new Set(field.value ?? []);
                                          if (next) {
                                            current.add(id);
                                          } else {
                                            current.delete(id);
                                          }
                                          field.onChange(Array.from(current));
                                        }}
                                      />
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium">
                                          {player.displayName ?? player.username ?? id}
                                        </span>
                                        {player.displayName && player.username ? (
                                          <span className="text-xs text-muted-foreground">{player.username}</span>
                                        ) : null}
                                      </div>
                                    </label>
                                  );
                                })
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

              {playerCountSummary ? (
                <div className="rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
                  {playerCountSummary}
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
                        <Textarea rows={3} placeholder="Explain why the XP is being granted" {...field} />
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
  );
};

export default AdminExperienceRewards;
