import { 
  Dice5, 
  Guitar, 
  Tv, 
  Disc3, 
  Handshake, 
  DollarSign, 
  Users, 
  Trophy,
  Inbox
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { InboxCategory } from "@/hooks/useInbox";

interface InboxFiltersProps {
  activeFilter: InboxCategory | 'all';
  onFilterChange: (filter: InboxCategory | 'all') => void;
  counts?: Record<string, number>;
}

const filterOptions: { value: InboxCategory | 'all'; label: string; icon: typeof Inbox }[] = [
  { value: 'all', label: 'All', icon: Inbox },
  { value: 'random_event', label: 'Events', icon: Dice5 },
  { value: 'gig_result', label: 'Gigs', icon: Guitar },
  { value: 'financial', label: 'Money', icon: DollarSign },
  { value: 'social', label: 'Social', icon: Users },
  { value: 'record_label', label: 'Labels', icon: Disc3 },
  { value: 'sponsorship', label: 'Sponsors', icon: Handshake },
  { value: 'pr_media', label: 'PR', icon: Tv },
  { value: 'achievement', label: 'Badges', icon: Trophy },
];

export function InboxFilters({ activeFilter, onFilterChange, counts }: InboxFiltersProps) {
  return (
    <Tabs value={activeFilter} onValueChange={(v) => onFilterChange(v as InboxCategory | 'all')}>
      <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
        {filterOptions.map((option) => {
          const Icon = option.icon;
          const count = counts?.[option.value] || 0;
          
          return (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className={cn(
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full",
                "border border-border bg-card hover:bg-muted"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{option.label}</span>
              {count > 0 && option.value !== 'all' && (
                <span className="ml-1 text-[10px] bg-muted-foreground/20 px-1.5 rounded-full">
                  {count}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
