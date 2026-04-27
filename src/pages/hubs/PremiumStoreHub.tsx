import { CategoryHub } from "@/components/CategoryHub";
import { Crown, UserPlus, Shirt, Sparkles } from "lucide-react";

export default function PremiumStoreHub() {
  return (
    <CategoryHub
      titleKey="In-Game Store"
      description="Buy premium memberships, extra character slots, and cosmetic items."
      tiles={[
        {
          icon: Crown,
          labelKey: "VIP Membership",
          path: "/vip-subscribe",
          tileImageKey: "premium-vip",
          imagePrompt: "An elegant gold VIP pass with crown emblem, glowing premium membership card on dark velvet",
        },
        {
          icon: UserPlus,
          labelKey: "Character Slots",
          path: "/buy-character-slot",
          tileImageKey: "premium-slots",
          imagePrompt: "Multiple silhouetted rock-star avatars on a roster grid with one empty glowing slot to be filled",
        },
        {
          icon: Shirt,
          labelKey: "Skin Store",
          path: "/skin-store",
          tileImageKey: "premium-skins",
          imagePrompt: "A colorful shop displaying character skins, outfits, and accessories for purchase",
        },
        {
          icon: Sparkles,
          labelKey: "Cosmetics & Boosts",
          path: "/premium-store",
          tileImageKey: "premium-cosmetics",
          imagePrompt: "Sparkling premium cosmetic items, glowing power-ups and gift boxes on a stage",
          description: "Coming soon",
        },
      ]}
    />
  );
}
