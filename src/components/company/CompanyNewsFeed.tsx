import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Newspaper, Pin, PinOff, Eye, EyeOff, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CompanyNewsFeedProps {
  companyId: string;
  isOwner: boolean;
}

interface NewsRow {
  id: string;
  company_id: string;
  event_type: string;
  headline: string;
  body: string | null;
  created_at: string;
  is_hidden: boolean;
  is_pinned: boolean;
}

const iconFor = (type: string) => {
  if (type.includes("bankrupt")) return { icon: AlertTriangle, color: "text-destructive" };
  if (type.includes("recover") || type.includes("milestone")) return { icon: TrendingUp, color: "text-emerald-400" };
  return { icon: Sparkles, color: "text-muted-foreground" };
};

export function CompanyNewsFeed({ companyId, isOwner }: CompanyNewsFeedProps) {
  const qc = useQueryClient();

  const { data: news = [], isLoading } = useQuery({
    queryKey: ["company-news", companyId, isOwner],
    queryFn: async () => {
      let q = supabase
        .from("company_news_events" as any)
        .select("id, company_id, event_type, headline, body, created_at, is_hidden, is_pinned")
        .eq("company_id", companyId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (!isOwner) q = q.eq("is_hidden", false);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as NewsRow[];
    },
  });

  const moderate = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<NewsRow, "is_hidden" | "is_pinned">> }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("company_news_events")
        .update({ ...patch, moderated_at: new Date().toISOString(), moderated_by: userRes.user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-news", companyId] }),
    onError: (e: any) => toast.error("Moderation failed", { description: e.message }),
  });

  if (isLoading) {
    return <div className="animate-pulse space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded" />)}</div>;
  }

  if (news.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Newspaper className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">No news yet. Bankruptcies, recoveries and milestones will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {news.map((n) => {
        const { icon: Icon, color } = iconFor(n.event_type);
        return (
          <Card key={n.id} className={`bg-card/60 ${n.is_hidden ? "opacity-60" : ""} ${n.is_pinned ? "border-primary/60" : ""}`}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{n.headline}</span>
                    {n.is_pinned && <Badge variant="secondary" className="text-[10px]"><Pin className="h-3 w-3 mr-1" />Pinned</Badge>}
                    {n.is_hidden && <Badge variant="outline" className="text-[10px]"><EyeOff className="h-3 w-3 mr-1" />Hidden</Badge>}
                    <Badge variant="outline" className="text-[10px]">{n.event_type}</Badge>
                  </div>
                  {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </div>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      title={n.is_pinned ? "Unpin" : "Pin to top"}
                      onClick={() => moderate.mutate({ id: n.id, patch: { is_pinned: !n.is_pinned } })}
                      disabled={moderate.isPending}
                    >
                      {n.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={n.is_hidden ? "Unhide" : "Hide from public"}
                      onClick={() => moderate.mutate({ id: n.id, patch: { is_hidden: !n.is_hidden } })}
                      disabled={moderate.isPending}
                    >
                      {n.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
