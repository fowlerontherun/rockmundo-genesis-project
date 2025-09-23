import { useCallback, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import { z } from "zod";

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

import {
  PlayerProfileOption,
  PlayerTargetingFormValues,
  describeAllRecipientCount,
  getAffectedCount,
  playerTargetingDefaultValues,
  extendPlayerTargetingSchema,
  resolveTargetProfileIds,
  usePlayerProfiles,
  useTargetScopeSynchronization,
} from "./playerBoosts.helpers";
import { adminAdjustMomentum, adminAwardSpecialXp, adminSetDailyXpAmount } from "@/utils/progression";

const momentumSchema = extendPlayerTargetingSchema({
    amount: z
      .coerce
      .number({ invalid_type_error: "Momentum change must be a number" })
      .refine((value) => Number.isFinite(value), "Momentum change must be a valid number")
      .refine((value) => value !== 0, "Enter a non-zero momentum change"),
    reason: z
      .string()
      .optional()
      .transform((value) => (typeof value === "string" ? value.trim() : "")),
  })
  .transform((value) => ({
    ...value,
    reason: value.reason ?? "",
  }));

type MomentumFormValues = z.infer<typeof momentumSchema>;

const momentumDefaultValues: MomentumFormValues = {
  ...playerTargetingDefaultValues,
  amount: 25,
  reason: "",
};

const xpBoostSchema = extendPlayerTargetingSchema({
  amount: z
    .coerce
    .number({ invalid_type_error: "XP amount must be a number" })
    .min(1, "XP amount must be at least 1"),
  reason: z.string().min(1, "Provide a reason for awarding XP"),
});

type XpBoostFormValues = z.infer<typeof xpBoostSchema>;

const xpBoostDefaultValues: XpBoostFormValues = {
  ...playerTargetingDefaultValues,
  amount: 100,
  reason: "Community momentum boost",
};

const stipendSchema = extendPlayerTargetingSchema({
  amount: z
    .coerce
    .number({ invalid_type_error: "Daily XP must be a number" })
    .min(0, "Daily XP cannot be negative"),
  reason: z
    .string()
    .optional()
    .transform((value) => (typeof value === "string" ? value.trim() : "")),
});

type StipendFormValues = z.infer<typeof stipendSchema>;

const stipendDefaultValues: StipendFormValues = {
  ...playerTargetingDefaultValues,
  amount: 150,
  reason: "",
};

type TargetingFieldsProps<TFormValues extends PlayerTargetingFormValues> = {
  form: UseFormReturn<TFormValues>;
  targetScope: TFormValues["targetScope"];
  playerProfiles: PlayerProfileOption[];
  isLoadingPlayers: boolean;
  idPrefix: string;
};

function TargetingFields<TFormValues extends PlayerTargetingFormValues>({
  form,
  targetScope,
  playerProfiles,
  isLoadingPlayers,
  idPrefix,
}: TargetingFieldsProps<TFormValues>) {
  return (
    <>
      <FormField
        control={form.control}
        name="targetScope"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Recipients</FormLabel>
            <FormDescription>Choose which player profiles should receive this update.</FormDescription>
            <FormControl>
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 md:grid-cols-3">
                <div className={`rounded-md border p-3 transition ${field.value === "single" ? "border-primary" : ""}`}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="single" id={`${idPrefix}-target-single`} />
                    <Label htmlFor={`${idPrefix}-target-single`} className="font-medium">
                      Single player
                    </Label>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Apply the change to one selected profile.</p>
                </div>
                <div className={`rounded-md border p-3 transition ${field.value === "multiple" ? "border-primary" : ""}`}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="multiple" id={`${idPrefix}-target-multiple`} />
                    <Label htmlFor={`${idPrefix}-target-multiple`} className="font-medium">
                      Multiple players
                    </Label>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Select a custom list of profiles.</p>
                </div>
                <div className={`rounded-md border p-3 transition ${field.value === "all" ? "border-primary" : ""}`}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="all" id={`${idPrefix}-target-all`} />
                    <Label htmlFor={`${idPrefix}-target-all`} className="font-medium">
                      All players
                    </Label>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Every profile currently in the world.</p>
                </div>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {targetScope === "single" ? (
        <FormField
          control={form.control}
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
                    <SelectValue placeholder={isLoadingPlayers ? "Loading players..." : "Select a player"} />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingPlayers ? (
                      <SelectItem value="__loading" disabled>
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading players...
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
                              <span className="text-sm font-medium">{player.displayName ?? player.username ?? id}</span>
                              {player.displayName && player.username ? (
                                <span className="text-xs text-muted-foreground">{player.username}</span>
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
          control={form.control}
          name="profileIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Players</FormLabel>
              <FormDescription>Select each player who should be included.</FormDescription>
              <FormControl>
                <div className="rounded-md border">
                  <ScrollArea className="max-h-64">
                    <div className="flex flex-col gap-2 p-2">
                      {isLoadingPlayers ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading players...
                        </div>
                      ) : playerProfiles.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No player profiles found.</div>
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
                                  <span className="text-sm font-medium">{player.displayName ?? player.username ?? id}</span>
                                  {player.displayName && player.username ? (
                                    <span className="text-xs text-muted-foreground">{player.username}</span>
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
          {describeAllRecipientCount(isLoadingPlayers, playerProfiles.length)}
        </div>
      ) : null}
    </>
  );
}

export default function PlayerBoosts() {
  const { toast } = useToast();
  const { playerProfiles, isLoadingPlayers, fetchPlayerProfiles } = usePlayerProfiles();

  const [isAdjustingMomentum, setIsAdjustingMomentum] = useState(false);
  const [isAwardingXp, setIsAwardingXp] = useState(false);
  const [isUpdatingStipend, setIsUpdatingStipend] = useState(false);

  const momentumForm = useForm<MomentumFormValues>({
    resolver: zodResolver(momentumSchema),
    defaultValues: momentumDefaultValues,
  });
  const xpBoostForm = useForm<XpBoostFormValues>({
    resolver: zodResolver(xpBoostSchema),
    defaultValues: xpBoostDefaultValues,
  });
  const stipendForm = useForm<StipendFormValues>({
    resolver: zodResolver(stipendSchema),
    defaultValues: stipendDefaultValues,
  });

  const { targetScope: momentumScope, selectedProfileCount: momentumSelectedCount } =
    useTargetScopeSynchronization(momentumForm);
  const { targetScope: xpScope, selectedProfileCount: xpSelectedCount } = useTargetScopeSynchronization(xpBoostForm);
  const { targetScope: stipendScope, selectedProfileCount: stipendSelectedCount } =
    useTargetScopeSynchronization(stipendForm);

  const rosterSize = playerProfiles.length;

  const isMomentumRecipientsReady = momentumScope === "all" || (!isLoadingPlayers && playerProfiles.length > 0);
  const isXpRecipientsReady = xpScope === "all" || (!isLoadingPlayers && playerProfiles.length > 0);
  const isStipendRecipientsReady = stipendScope === "all" || (!isLoadingPlayers && playerProfiles.length > 0);

  const handleMomentumSubmit = useCallback(
    async (values: MomentumFormValues) => {
      setIsAdjustingMomentum(true);
      try {
        const profileIds = resolveTargetProfileIds(values);
        const response = await adminAdjustMomentum({
          amount: values.amount,
          reason: values.reason,
          profileIds,
          applyToAll: values.targetScope === "all",
          metadata: { source: "admin_panel" },
        });

        const responseCount =
          typeof response?.result === "object" && response?.result !== null && "affected_count" in response.result
            ? Number((response.result as Record<string, unknown>).affected_count)
            : null;

        const affectedCount = getAffectedCount(values, rosterSize, responseCount);

        toast({
          title: "Momentum updated",
          description: `Adjusted momentum by ${values.amount} for ${affectedCount} player${affectedCount === 1 ? "" : "s"}.`,
        });

        momentumForm.reset({
          ...momentumDefaultValues,
          targetScope: values.targetScope,
        });
      } catch (error) {
        console.error("Failed to adjust momentum", error);
        toast({
          variant: "destructive",
          title: "Unable to adjust momentum",
          description:
            error instanceof Error ? error.message : "Something went wrong while updating player momentum.",
        });
      } finally {
        setIsAdjustingMomentum(false);
      }
    },
    [momentumForm, rosterSize, toast],
  );

  const handleXpSubmit = useCallback(
    async (values: XpBoostFormValues) => {
      setIsAwardingXp(true);
      try {
        const profileIds = resolveTargetProfileIds(values);
        const response = await adminAwardSpecialXp({
          amount: values.amount,
          reason: values.reason,
          profileIds,
          applyToAll: values.targetScope === "all",
          metadata: { source: "admin_panel" },
        });

        const responseCount =
          typeof response?.result === "object" && response?.result !== null && "awarded_count" in response.result
            ? Number((response.result as Record<string, unknown>).awarded_count)
            : null;

        const affectedCount = getAffectedCount(values, rosterSize, responseCount);

        toast({
          title: "XP boost delivered",
          description: `Granted ${values.amount} XP to ${affectedCount} player${affectedCount === 1 ? "" : "s"}.`,
        });

        xpBoostForm.reset({
          ...xpBoostDefaultValues,
          targetScope: values.targetScope,
        });
      } catch (error) {
        console.error("Failed to award XP boost", error);
        toast({
          variant: "destructive",
          title: "Unable to award XP",
          description: error instanceof Error ? error.message : "Something went wrong while awarding XP.",
        });
      } finally {
        setIsAwardingXp(false);
      }
    },
    [rosterSize, toast, xpBoostForm],
  );

  const handleStipendSubmit = useCallback(
    async (values: StipendFormValues) => {
      setIsUpdatingStipend(true);
      try {
        const profileIds = resolveTargetProfileIds(values);
        const response = await adminSetDailyXpAmount({
          amount: values.amount,
          reason: values.reason,
          profileIds,
          applyToAll: values.targetScope === "all",
          metadata: { source: "admin_panel" },
        });

        const responseCount =
          typeof response?.result === "object" && response?.result !== null && "updated_count" in response.result
            ? Number((response.result as Record<string, unknown>).updated_count)
            : null;

        const affectedCount = getAffectedCount(values, rosterSize, responseCount);

        toast({
          title: "Daily stipend updated",
          description: `Set daily XP to ${values.amount} for ${affectedCount} player${affectedCount === 1 ? "" : "s"}.`,
        });

        stipendForm.reset({
          ...stipendDefaultValues,
          targetScope: values.targetScope,
        });
      } catch (error) {
        console.error("Failed to update daily stipend", error);
        toast({
          variant: "destructive",
          title: "Unable to update stipend",
          description:
            error instanceof Error ? error.message : "Something went wrong while updating the daily stipend.",
        });
      } finally {
        setIsUpdatingStipend(false);
      }
    },
    [rosterSize, stipendForm, toast],
  );

  const disableMomentumSubmit = isAdjustingMomentum || !isMomentumRecipientsReady;
  const disableXpSubmit = isAwardingXp || !isXpRecipientsReady;
  const disableStipendSubmit = isUpdatingStipend || !isStipendRecipientsReady;

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-5xl space-y-6 p-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Admin Tools / Player Boosts</p>
          <h1 className="text-3xl font-semibold tracking-tight">Player Boosts</h1>
          <p className="text-muted-foreground">
            Adjust player momentum, award special XP, and configure daily stipends. After making changes, notify the
            affected players or community channel so they understand what changed.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Player roster loaded: {isLoadingPlayers ? "Loading..." : `${rosterSize} profile${rosterSize === 1 ? "" : "s"}`}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchPlayerProfiles()} disabled={isLoadingPlayers}>
            {isLoadingPlayers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refresh players
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Momentum boost</CardTitle>
            <CardDescription>Give players a short-term push or correct runaway momentum.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...momentumForm}>
              <form onSubmit={momentumForm.handleSubmit(handleMomentumSubmit)} className="space-y-6">
                <TargetingFields
                  form={momentumForm}
                  targetScope={momentumScope}
                  playerProfiles={playerProfiles}
                  isLoadingPlayers={isLoadingPlayers}
                  idPrefix="momentum"
                />

                <div className="grid gap-6 md:grid-cols-[minmax(0,200px)_1fr]">
                  <FormField
                    control={momentumForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Momentum change</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step={5}
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormDescription>Positive values add momentum; negative values remove it.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={momentumForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal note (optional)</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Document why the adjustment was made" {...field} />
                        </FormControl>
                        <FormDescription>This is stored in the audit trail for future reference.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {momentumScope === "multiple" ? (
                    <p className="text-sm text-muted-foreground">
                      Selected {momentumSelectedCount} player{momentumSelectedCount === 1 ? "" : "s"}.
                    </p>
                  ) : null}
                  <Button type="submit" disabled={disableMomentumSubmit}>
                    {isAdjustingMomentum ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isAdjustingMomentum ? "Updating momentum" : "Adjust momentum"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">XP boost</CardTitle>
            <CardDescription>Deliver special XP to celebrate milestones or fix data issues.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...xpBoostForm}>
              <form onSubmit={xpBoostForm.handleSubmit(handleXpSubmit)} className="space-y-6">
                <TargetingFields
                  form={xpBoostForm}
                  targetScope={xpScope}
                  playerProfiles={playerProfiles}
                  isLoadingPlayers={isLoadingPlayers}
                  idPrefix="xp"
                />

                <div className="grid gap-6 md:grid-cols-[minmax(0,200px)_1fr]">
                  <FormField
                    control={xpBoostForm.control}
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
                        <FormDescription>Each recipient receives this amount of XP instantly.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={xpBoostForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Explain why the XP is being granted" {...field} />
                        </FormControl>
                        <FormDescription>Players will see this reason in their notification.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {xpScope === "multiple" ? (
                    <p className="text-sm text-muted-foreground">
                      Selected {xpSelectedCount} player{xpSelectedCount === 1 ? "" : "s"}.
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

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Daily stipend</CardTitle>
            <CardDescription>Override the amount of XP players collect from their daily stipend.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...stipendForm}>
              <form onSubmit={stipendForm.handleSubmit(handleStipendSubmit)} className="space-y-6">
                <TargetingFields
                  form={stipendForm}
                  targetScope={stipendScope}
                  playerProfiles={playerProfiles}
                  isLoadingPlayers={isLoadingPlayers}
                  idPrefix="stipend"
                />

                <div className="grid gap-6 md:grid-cols-[minmax(0,200px)_1fr]">
                  <FormField
                    control={stipendForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Daily XP amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormDescription>Set the stipend XP each affected player collects per day.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={stipendForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal note (optional)</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Record why this stipend change was made" {...field} />
                        </FormControl>
                        <FormDescription>This helps future admins understand the stipend adjustment.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {stipendScope === "multiple" ? (
                    <p className="text-sm text-muted-foreground">
                      Selected {stipendSelectedCount} player{stipendSelectedCount === 1 ? "" : "s"}.
                    </p>
                  ) : null}
                  <Button type="submit" disabled={disableStipendSubmit}>
                    {isUpdatingStipend ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isUpdatingStipend ? "Updating stipend" : "Set stipend"}
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
