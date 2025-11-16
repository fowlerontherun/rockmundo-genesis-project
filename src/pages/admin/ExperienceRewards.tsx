import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Award, Users, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  xpGrantSchema,
  xpGrantDefaultValues,
  type XpGrantFormValues,
  type PlayerProfileOption,
  type TargetScope
} from "./experienceRewards.helpers";

const ExperienceRewards = () => {
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<XpGrantFormValues>({
    resolver: zodResolver(xpGrantSchema),
    defaultValues: xpGrantDefaultValues,
  });

  const targetScope = watch("targetScope");

  // Fetch all player profiles for selection
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, display_name, username")
        .order("display_name");
      
      if (error) throw error;
      return (data || []).map((p) => ({
        profileId: p.id,
        userId: p.user_id,
        displayName: p.display_name,
        username: p.username,
      })) as PlayerProfileOption[];
    },
  });

  const onSubmit = async (values: XpGrantFormValues) => {
    try {
      const profileIds = targetScope === "single" ? [values.profileId!] :
                        targetScope === "multiple" ? selectedProfiles : [];
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("progression", {
        body: {
          action: "admin_award_special_xp",
          amount: values.amount,
          reason: values.reason,
          profileIds,
          apply_to_all: targetScope === "all",
        },
      });

      if (response.error) throw response.error;

      toast.success(
        `Awarded ${values.amount} XP to ${response.data.profiles_updated} player(s)`,
        { description: values.reason }
      );

      // Reset form
      setValue("amount", 100);
      setValue("reason", "");
      setSelectedProfiles([]);
    } catch (error: any) {
      toast.error("Failed to award XP", {
        description: error.message || "Please try again",
      });
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Award className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Experience Rewards</h1>
          <p className="text-muted-foreground">Award XP to players for events, contests, or special achievements</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Grant XP Award
            </CardTitle>
            <CardDescription>
              Choose target scope and award XP with a descriptive reason
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Target Scope */}
            <div className="space-y-3">
              <Label>Target Scope</Label>
              <RadioGroup
                value={targetScope}
                onValueChange={(value) => setValue("targetScope", value as TargetScope)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single" id="single" />
                  <Label htmlFor="single" className="font-normal cursor-pointer">
                    Single Player
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="multiple" id="multiple" />
                  <Label htmlFor="multiple" className="font-normal cursor-pointer">
                    Multiple Players
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="font-normal cursor-pointer">
                    All Players (Server-wide)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Single Player Selection */}
            {targetScope === "single" && (
              <div className="space-y-2">
                <Label htmlFor="profileId">Select Player</Label>
                <Select
                  value={watch("profileId") || ""}
                  onValueChange={(value) => setValue("profileId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a player..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                    <SelectItem key={profile.profileId} value={profile.profileId}>
                      {profile.displayName || profile.username || "Unknown"}
                    </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.profileId && (
                  <p className="text-sm text-destructive">{errors.profileId.message}</p>
                )}
              </div>
            )}

            {/* Multiple Players Selection */}
            {targetScope === "multiple" && (
              <div className="space-y-2">
                <Label>Select Players ({selectedProfiles.length} selected)</Label>
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                  {isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading players...</p>
                  ) : profiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No players found</p>
                  ) : (
                    profiles.map((profile) => {
                      const isSelected = selectedProfiles.includes(profile.profileId);
                      return (
                        <div
                          key={profile.profileId}
                          onClick={() => {
                            setSelectedProfiles((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== profile.profileId)
                                : [...prev, profile.profileId]
                            );
                            setValue("profileIds", isSelected 
                              ? selectedProfiles.filter((id) => id !== profile.profileId)
                              : [...selectedProfiles, profile.profileId]
                            );
                          }}
                          className={`p-2 rounded cursor-pointer transition-colors ${
                            isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm">
                              {profile.displayName || profile.username || "Unknown"}
                            </span>
                            {isSelected && <Badge variant="secondary">Selected</Badge>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {errors.profileIds && (
                  <p className="text-sm text-destructive">{errors.profileIds.message}</p>
                )}
              </div>
            )}

            {/* All Players Info */}
            {targetScope === "all" && (
              <div className="border border-warning/50 bg-warning/10 rounded-lg p-4 flex items-start gap-3">
                <Users className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Server-wide Award</p>
                  <p className="text-sm text-muted-foreground">
                    This will grant XP to all registered players. Use this for special events or community milestones.
                  </p>
                </div>
              </div>
            )}

            {/* XP Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">XP Amount</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                {...register("amount", { valueAsNumber: true })}
                placeholder="100"
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Award</Label>
              <Textarea
                id="reason"
                {...register("reason")}
                placeholder="e.g., First place in weekend songwriting contest"
                rows={3}
              />
              {errors.reason && (
                <p className="text-sm text-destructive">{errors.reason.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full">
              <Award className="h-4 w-4 mr-2" />
              Award XP
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default ExperienceRewards;
