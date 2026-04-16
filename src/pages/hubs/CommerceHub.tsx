import { CategoryHub } from "@/components/CategoryHub";
import { Store, ShoppingCart, ShoppingBag } from "lucide-react";

export default function CommerceHub() {
  return (
    <CategoryHub
      titleKey="nav.commerce"
      description="Inventory, merchandise, and the player marketplace."
      tiles={[
        { icon: Store, labelKey: "nav.inventory", path: "/inventory", imagePrompt: "A warehouse with music merchandise: t-shirts, posters, vinyl records on shelves" },
        { icon: ShoppingCart, labelKey: "nav.merchandise", path: "/merchandise", imagePrompt: "A merch table at a concert with t-shirts, hats, posters, and fans browsing" },
        { icon: ShoppingBag, labelKey: "In-Game Market", path: "/in-game-market", tileImageKey: "in-game-market", imagePrompt: "A bustling indoor marketplace bazaar with stalls selling musical gear, vintage clothes, rare books and mysterious items" },
      ]}
    />
  );
}
