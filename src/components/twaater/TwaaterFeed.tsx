import { useTwaaterFeed } from "@/hooks/useTwaats";
import { useTwaaterMentions } from "@/hooks/useTwaaterMentions";
import { TwaatCard } from "./TwaatCard";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface TwaaterFeedProps {
  viewerAccountId?: string;
  feedType?: "feed" | "mentions";
}

export const TwaaterFeed = ({ viewerAccountId, feedType = "feed" }: TwaaterFeedProps) => {
  const { feed, isLoading: feedLoading } = useTwaaterFeed(feedType === "feed" ? viewerAccountId : undefined);
  const { mentions, isLoading: mentionsLoading } = useTwaaterMentions(feedType === "mentions" ? viewerAccountId : undefined);

  const isLoading = feedType === "feed" ? feedLoading : mentionsLoading;
  const items = feedType === "feed" ? feed : mentions?.map(m => m.twaat).filter(Boolean);

  if (isLoading) return <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  if (!items?.length) return <Card><CardContent className="py-12 text-center text-muted-foreground">No {feedType === "mentions" ? "mentions" : "twaats"} yet</CardContent></Card>;

  return <div>{items.map((twaat: any) => twaat && <TwaatCard key={twaat.id} twaat={twaat} viewerAccountId={viewerAccountId || ""} />)}</div>;
};
