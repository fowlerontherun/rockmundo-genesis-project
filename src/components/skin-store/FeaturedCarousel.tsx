import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StoreItemCard } from "./StoreItemCard";
import { ClothingItem } from "@/hooks/useSkinStore";

interface FeaturedCarouselProps {
  items: ClothingItem[];
  ownedItemIds: string[];
  onPurchase: (item: ClothingItem) => void;
  onPreview?: (item: ClothingItem) => void;
}

export const FeaturedCarousel = ({
  items,
  ownedItemIds,
  onPurchase,
  onPreview,
}: FeaturedCarouselProps) => {
  const [startIndex, setStartIndex] = useState(0);
  const itemsPerView = 4;

  const canScrollLeft = startIndex > 0;
  const canScrollRight = startIndex + itemsPerView < items.length;

  const scrollLeft = () => {
    setStartIndex(Math.max(0, startIndex - 1));
  };

  const scrollRight = () => {
    setStartIndex(Math.min(items.length - itemsPerView, startIndex + 1));
  };

  const visibleItems = items.slice(startIndex, startIndex + itemsPerView);

  if (items.length === 0) return null;

  return (
    <div className="relative">
      {/* Navigation Buttons */}
      {canScrollLeft && (
        <Button
          variant="outline"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-background/90"
          onClick={scrollLeft}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      
      {canScrollRight && (
        <Button
          variant="outline"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-background/90"
          onClick={scrollRight}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Items Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {visibleItems.map((item) => (
          <StoreItemCard
            key={item.id}
            item={item}
            isOwned={ownedItemIds.includes(item.id)}
            onPurchase={onPurchase}
            onPreview={onPreview}
          />
        ))}
      </div>

      {/* Dots Indicator */}
      {items.length > itemsPerView && (
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: Math.ceil(items.length / itemsPerView) }).map((_, idx) => (
            <button
              key={idx}
              className={`w-2 h-2 rounded-full transition-colors ${
                Math.floor(startIndex / itemsPerView) === idx
                  ? "bg-primary"
                  : "bg-muted"
              }`}
              onClick={() => setStartIndex(idx * itemsPerView)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
