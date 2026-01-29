// Character Backstory Card - Displays AI-generated backstory
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlayerCharacterIdentity } from "@/hooks/useCharacterIdentity";
import { BookOpen } from "lucide-react";

export const CharacterBackstoryCard = () => {
  const { data: identity, isLoading } = usePlayerCharacterIdentity();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            Your Story
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!identity?.backstory_text) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5" />
          Your Story
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px] pr-4">
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {identity.backstory_text}
          </p>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
