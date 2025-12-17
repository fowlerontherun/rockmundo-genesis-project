import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Sparkles, Calendar, Gift } from "lucide-react";
import { CountdownTimer } from "./CountdownTimer";
import { SkinCollection } from "@/hooks/useSkinStore";

interface CollectionCardProps {
  collection: SkinCollection;
  itemCount?: number;
  onViewCollection: (collectionId: string) => void;
}

const themeIcons: Record<string, React.ReactNode> = {
  holiday: <Gift className="h-4 w-4" />,
  vip: <Sparkles className="h-4 w-4" />,
  seasonal: <Calendar className="h-4 w-4" />,
  limited: <Sparkles className="h-4 w-4" />,
};

const themeColors: Record<string, string> = {
  holiday: "bg-destructive/20 text-destructive border-destructive/30",
  vip: "bg-warning/20 text-warning border-warning/30",
  seasonal: "bg-primary/20 text-primary border-primary/30",
  limited: "bg-accent/20 text-accent border-accent/30",
  monthly: "bg-secondary text-secondary-foreground border-secondary",
  event: "bg-success/20 text-success border-success/30",
  artist_collab: "bg-primary/20 text-primary border-primary/30",
};

export const CollectionCard = ({
  collection,
  itemCount = 0,
  onViewCollection,
}: CollectionCardProps) => {
  const isLimited = !!collection.ends_at;
  const themeClass = themeColors[collection.theme || "monthly"] || themeColors.monthly;

  return (
    <Card className="overflow-hidden hover:shadow-electric transition-all duration-300 group">
      {/* Banner Image */}
      <div className="relative h-32 bg-gradient-primary">
        {collection.banner_image_url ? (
          <img
            src={collection.banner_image_url}
            alt={collection.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Sparkles className="h-12 w-12 text-primary-foreground/50" />
          </div>
        )}
        
        {/* Theme Badge */}
        {collection.theme && (
          <Badge
            variant="outline"
            className={`absolute top-2 left-2 ${themeClass}`}
          >
            {themeIcons[collection.theme]}
            <span className="ml-1 capitalize">{collection.theme.replace("_", " ")}</span>
          </Badge>
        )}

        {/* Limited Time Badge */}
        {isLimited && (
          <div className="absolute top-2 right-2">
            <CountdownTimer endDate={collection.ends_at!} />
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">
          {collection.name}
        </h3>
        
        {collection.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {collection.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewCollection(collection.id)}
            className="group-hover:text-primary"
          >
            View Collection
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
