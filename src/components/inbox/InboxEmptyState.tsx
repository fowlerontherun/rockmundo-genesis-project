import { Inbox, Music } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface InboxEmptyStateProps {
  filter: string;
}

export function InboxEmptyState({ filter }: InboxEmptyStateProps) {
  const isFiltered = filter !== 'all';

  return (
    <EmptyState
      icon={isFiltered ? Inbox : Music}
      title={isFiltered ? "No messages in this category" : "Your inbox is empty"}
      description={
        isFiltered 
          ? "Try selecting a different category or check back later."
          : "Play gigs, release music, and make choices to receive messages here. Your journey awaits!"
      }
      className="min-h-[300px]"
    />
  );
}
