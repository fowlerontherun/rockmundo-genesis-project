import { useState } from "react";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import { RefreshCw } from "lucide-react";
import { TwaatCard } from "./TwaatCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TwaatData {
  id: string;
  body: string;
  created_at: string;
  linked_type?: string;
  linked_id?: string;
  parent_twaat_id?: string;
  quoted_twaat_id?: string;
  account: {
    id: string;
    handle: string;
    display_name: string;
    verified: boolean;
    owner_type: string;
  };
  metrics?: {
    likes: number;
    replies: number;
    retwaats: number;
    views: number;
  };
  retwaat_by?: {
    handle: string;
    display_name: string;
  };
}

interface TwaaterTimelineProps {
  twaats: TwaatData[];
  isLoading?: boolean;
  onRefresh?: () => void;
  currentAccountId?: string;
  showDateSeparators?: boolean;
}

function getDateLabel(dateString: string): string {
  const date = new Date(dateString);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisWeek(date)) return format(date, "EEEE");
  return format(date, "MMM d, yyyy");
}

function groupTwaatsByDate(twaats: TwaatData[]): Map<string, TwaatData[]> {
  const groups = new Map<string, TwaatData[]>();
  
  twaats.forEach(twaat => {
    const label = getDateLabel(twaat.created_at);
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(twaat);
  });
  
  return groups;
}

export default function TwaaterTimeline({
  twaats,
  isLoading,
  onRefresh,
  currentAccountId,
  showDateSeparators = true,
}: TwaaterTimelineProps) {
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const groupedTwaats = showDateSeparators ? groupTwaatsByDate(twaats) : null;

  const toggleThread = (twaatId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(twaatId)) {
        next.delete(twaatId);
      } else {
        next.add(twaatId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-[#a855f7]" />
      </div>
    );
  }

  if (!twaats.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No twaats yet. Be the first to post!</p>
      </div>
    );
  }

  const renderTwaat = (twaat: TwaatData, isLast: boolean, showConnector: boolean = true) => (
    <div key={twaat.id} className="relative">
      {/* Timeline connector line */}
      {showConnector && !isLast && (
        <div 
          className="absolute left-6 top-14 bottom-0 w-0.5 bg-[#a855f7]/20"
          aria-hidden="true"
        />
      )}
      
      {/* Retwaat header */}
      {twaat.retwaat_by && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-12 mb-1">
          <RefreshCw className="h-3 w-3" />
          <span>@{twaat.retwaat_by.handle} retwaated</span>
        </div>
      )}
      
      <TwaatCard
        id={twaat.id}
        body={twaat.body}
        createdAt={twaat.created_at}
        account={twaat.account}
        metrics={twaat.metrics}
        linkedType={twaat.linked_type}
        linkedId={twaat.linked_id}
        currentAccountId={currentAccountId}
        isReply={!!twaat.parent_twaat_id}
        isQuote={!!twaat.quoted_twaat_id}
        onToggleThread={() => toggleThread(twaat.id)}
        isThreadExpanded={expandedThreads.has(twaat.id)}
      />
    </div>
  );

  if (groupedTwaats) {
    return (
      <div className="space-y-2">
        {onRefresh && (
          <div className="flex justify-end mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="text-[#a855f7] hover:text-[#a855f7]/80"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        )}
        
        {Array.from(groupedTwaats.entries()).map(([dateLabel, dateTwaats]) => (
          <div key={dateLabel}>
            {/* Date separator */}
            <div className="flex items-center gap-3 py-3">
              <div className="flex-1 h-px bg-[#a855f7]/20" />
              <span className="text-xs font-medium text-[#a855f7] px-2 py-1 bg-[#a855f7]/10 rounded-full">
                {dateLabel}
              </span>
              <div className="flex-1 h-px bg-[#a855f7]/20" />
            </div>
            
            {/* Twaats for this date */}
            <div className="space-y-1">
              {dateTwaats.map((twaat, index) => 
                renderTwaat(twaat, index === dateTwaats.length - 1)
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Without date separators
  return (
    <div className="space-y-1">
      {onRefresh && (
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="text-[#a855f7] hover:text-[#a855f7]/80"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      )}
      
      {twaats.map((twaat, index) => 
        renderTwaat(twaat, index === twaats.length - 1, false)
      )}
    </div>
  );
}
