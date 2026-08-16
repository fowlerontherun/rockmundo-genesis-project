import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_profile_id: string;
}

export function CompanyReviewsPanel({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const { data: reviews = [] } = useQuery({
    queryKey: ["company-reviews", companyId],
    queryFn: async (): Promise<ReviewRow[]> => {
      const { data, error } = await (supabase as any)
        .from("company_reviews")
        .select("id, rating, comment, created_at, reviewer_profile_id")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ReviewRow[];
    },
    enabled: !!companyId,
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("submit_company_review", {
        p_company_id: companyId,
        p_rating: rating,
        p_comment: comment,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review submitted");
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["company-reviews", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-storefront", companyId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not submit review"),
  });

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4" /> Customer reviews
        </CardTitle>
        <CardDescription>
          {reviews.length ? `${avg.toFixed(1)} / 5 from ${reviews.length} reviews` : "No reviews yet"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isOwner && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
                  <Star className={`h-5 w-5 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How was the service?"
              rows={2}
            />
            <Button size="sm" onClick={() => submit.mutate()} disabled={submit.isPending}>
              Submit review
            </Button>
          </div>
        )}
        {reviews.map((r) => (
          <div key={r.id} className="rounded-lg border p-2.5">
            <div className="flex items-center gap-1">
              {Array.from({ length: r.rating }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />
              ))}
              <span className="ml-2 text-[11px] text-muted-foreground">
                {format(new Date(r.created_at), "d MMM yyyy")}
              </span>
            </div>
            {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
