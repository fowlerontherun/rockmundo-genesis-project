import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Clock, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export const TwaaterScheduledFeed = ({ accountId }: { accountId: string }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: scheduledTwaats, isLoading, error, refetch } = useQuery({
    queryKey: ["twaater-scheduled", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("twaats")
        .select("id, body, scheduled_for, created_at, linked_type")
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .not("scheduled_for", "is", null)
        .order("scheduled_for", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const cancelMutation = useMutation({
    mutationFn: async (twaatId: string) => {
      const { error } = await supabase
        .from("twaats")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", twaatId)
        .eq("account_id", accountId)
        .not("scheduled_for", "is", null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-scheduled", accountId] });
      queryClient.invalidateQueries({ queryKey: ["twaats"] });
      toast({ title: "Scheduled Twaat cancelled" });
    },
    onError: (mutationError: any) => {
      toast({
        title: "Couldn't cancel scheduled Twaat",
        description: mutationError?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
        <CardContent className="py-12 text-center space-y-3">
          <p className="text-muted-foreground">Scheduled Twaats couldn't load.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!scheduledTwaats?.length) {
    return (
      <Card style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No scheduled Twaats</p>
          <p className="text-xs mt-1">Use Schedule in the composer to queue a future post.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {scheduledTwaats.map((twaat) => {
        const publishAt = twaat.scheduled_for ? new Date(twaat.scheduled_for) : null;
        return (
          <Card
            key={twaat.id}
            className="rounded-none border-x-0 border-t-0 p-4"
            style={{ backgroundColor: "hsl(var(--twaater-card))", borderColor: "hsl(var(--twaater-border))" }}
          >
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 mt-1 text-[hsl(var(--twaater-purple))]" />
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm whitespace-pre-wrap break-words">{twaat.body}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {publishAt
                      ? `Publishes ${publishAt.toLocaleString()} (${formatDistanceToNow(publishAt, { addSuffix: true })})`
                      : "Publication time unavailable"}
                  </span>
                  {twaat.linked_type && <span>· Linked {twaat.linked_type}</span>}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(twaat.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
