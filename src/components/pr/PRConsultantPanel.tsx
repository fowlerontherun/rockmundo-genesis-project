import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVipStatus } from "@/hooks/useVipStatus";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Briefcase,
  Crown,
  Lock,
  DollarSign,
  Zap,
  CheckCircle,
  Clock,
  Star,
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { useState } from "react";

interface PRConsultantPanelProps {
  userId: string;
  bandId: string;
}

const CONSULTANT_MONTHLY_FEE = 10000;

export function PRConsultantPanel({ userId, bandId }: PRConsultantPanelProps) {
  const queryClient = useQueryClient();
  const { data: vipStatus, isLoading: vipLoading } = useVipStatus();
  const [selectedConsultant, setSelectedConsultant] = useState<string>("");

  // Fetch available consultants
  const { data: consultants, isLoading: consultantsLoading } = useQuery({
    queryKey: ["pr-consultants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pr_consultants")
        .select("*")
        .eq("is_active", true)
        .order("success_rate", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch current consultant subscription
  const { data: activeConsultant, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["player-pr-consultant", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_pr_consultants")
        .select(`
          *,
          pr_consultants(name, specialty, success_rate, tier)
        `)
        .eq("user_id", userId)
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Hire consultant mutation
  const hireMutation = useMutation({
    mutationFn: async (consultantId: string) => {
      const consultant = consultants?.find(c => c.id === consultantId);
      if (!consultant) throw new Error("Consultant not found");

      const expiresAt = addDays(new Date(), 30);

      const { error } = await supabase
        .from("player_pr_consultants")
        .insert({
          user_id: userId,
          consultant_id: consultantId as any,
          expires_at: expiresAt.toISOString(),
          monthly_fee: consultant.weekly_fee * 4 || CONSULTANT_MONTHLY_FEE,
          auto_accept_enabled: true,
        });

      if (error) throw error;
      return { consultant, expiresAt };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["player-pr-consultant", userId] });
      toast.success(`Hired ${data.consultant.name}!`, {
        description: `Your PR consultant will handle offers until ${format(data.expiresAt, "MMM d, yyyy")}`,
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to hire consultant", { description: error.message });
    },
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!activeConsultant?.id) throw new Error("No active subscription");
      
      const { error } = await supabase
        .from("player_pr_consultants")
        .update({ auto_accept_enabled: false })
        .eq("id", activeConsultant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-pr-consultant", userId] });
      toast.success("Auto-accept disabled");
    },
    onError: (error: Error) => {
      toast.error("Failed to update settings", { description: error.message });
    },
  });

  if (vipLoading || consultantsLoading || subscriptionLoading) {
    return <Skeleton className="h-64" />;
  }

  const isVip = vipStatus?.isVip;

  if (!isVip) {
    return (
      <Card className="bg-card/50 backdrop-blur">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 w-fit rounded-full bg-amber-500/20 p-4">
            <Crown className="h-8 w-8 text-amber-500" />
          </div>
          <h3 className="text-xl font-semibold">VIP Feature</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            PR Consultants are available exclusively to VIP members. Upgrade to unlock automatic PR management!
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">What you get:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Automatic offer acceptance based on your preferences
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Priority access to high-profile appearances
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Specialized consultants for different media types
              </li>
            </ul>
          </div>
          <Button className="mt-6" variant="outline">
            <Crown className="mr-2 h-4 w-4" />
            Learn About VIP
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Consultant */}
      {activeConsultant && (
        <Card className="border-amber-500/50 bg-gradient-to-r from-amber-900/20 to-card backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5 text-amber-500" />
                Your PR Consultant
              </CardTitle>
              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                <CheckCircle className="mr-1 h-3 w-3" />
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">{activeConsultant.pr_consultants?.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {activeConsultant.pr_consultants?.specialty}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline">
                    <Star className="mr-1 h-3 w-3" />
                    {activeConsultant.pr_consultants?.tier} Tier
                  </Badge>
                  <span className="text-muted-foreground">
                    {(activeConsultant.pr_consultants?.success_rate || 0) * 100}% Success Rate
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-right">
                <p className="text-sm text-muted-foreground">
                  Expires: {format(parseISO(activeConsultant.expires_at), "MMM d, yyyy")}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={activeConsultant.auto_accept_enabled ? "default" : "outline"}
                    onClick={() => {
                      if (activeConsultant.auto_accept_enabled) {
                        cancelMutation.mutate();
                      }
                    }}
                  >
                    <Zap className="mr-1 h-4 w-4" />
                    Auto-Accept: {activeConsultant.auto_accept_enabled ? "ON" : "OFF"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hire New Consultant */}
      {!activeConsultant && (
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Hire a PR Consultant
            </CardTitle>
            <CardDescription>
              Choose a consultant to manage your PR opportunities automatically
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
              <SelectTrigger>
                <SelectValue placeholder="Select a consultant" />
              </SelectTrigger>
              <SelectContent>
                {consultants?.map((consultant) => (
                  <SelectItem key={consultant.id} value={consultant.id}>
                    <div className="flex items-center gap-2">
                      <span>{consultant.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {consultant.tier}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ${(consultant.weekly_fee * 4 || CONSULTANT_MONTHLY_FEE).toLocaleString()}/mo
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedConsultant && (
              <div className="rounded-lg bg-muted/50 p-4">
                {(() => {
                  const consultant = consultants?.find(c => c.id === selectedConsultant);
                  if (!consultant) return null;
                  return (
                    <div className="space-y-2">
                      <h4 className="font-semibold">{consultant.name}</h4>
                      <p className="text-sm text-muted-foreground">{consultant.specialty}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          <Star className="mr-1 h-3 w-3" />
                          {consultant.tier} Tier
                        </Badge>
                        <Badge variant="secondary">
                          {(consultant.success_rate || 0) * 100}% Success
                        </Badge>
                        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                          <DollarSign className="mr-1 h-3 w-3" />
                          ${(consultant.weekly_fee * 4 || CONSULTANT_MONTHLY_FEE).toLocaleString()}/month
                        </Badge>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => hireMutation.mutate(selectedConsultant)}
              disabled={!selectedConsultant || hireMutation.isPending}
            >
              <Briefcase className="mr-2 h-4 w-4" />
              Hire Consultant
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Available Consultants Grid */}
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Available Consultants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {consultants?.map((consultant) => (
              <div
                key={consultant.id}
                className="rounded-lg border bg-card/50 p-3 transition-colors hover:bg-card"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{consultant.name}</h4>
                    <p className="text-xs text-muted-foreground">{consultant.specialty}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {consultant.tier}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-amber-400">
                    {(consultant.success_rate || 0) * 100}% Success
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-emerald-400">
                    ${(consultant.weekly_fee * 4 || CONSULTANT_MONTHLY_FEE).toLocaleString()}/mo
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
