import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2 } from "lucide-react";

interface QuotedTwaatProps {
  twaat: any;
}

export const QuotedTwaat = ({ twaat }: QuotedTwaatProps) => {
  if (!twaat) return null;

  return (
    <Card className="p-3 mt-2 border-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <span className="font-semibold text-sm truncate">
              {twaat.account?.display_name}
            </span>
            {twaat.account?.verified && (
              <CheckCircle2 className="h-3 w-3 text-blue-500 flex-shrink-0" />
            )}
            <span className="text-muted-foreground text-sm">
              @{twaat.account?.handle}
            </span>
            <span className="text-muted-foreground text-sm">·</span>
            <span className="text-muted-foreground text-sm">
              {formatDistanceToNow(new Date(twaat.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm line-clamp-3">{twaat.body}</p>
          {twaat.media_url && (
            <img 
              src={twaat.media_url} 
              alt="Twaat media"
              className="mt-2 rounded max-h-32 object-cover"
            />
          )}
        </div>
      </div>
    </Card>
  );
};