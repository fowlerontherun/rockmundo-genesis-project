import { CategoryHub } from "@/components/CategoryHub";
import { Store, ShoppingCart } from "lucide-react";

export default function CommerceHub() {
  return (
    <CategoryHub
      titleKey="nav.commerce"
      description="Inventory and merchandise management."
      tiles={[
        { icon: Store, labelKey: "nav.inventory", path: "/inventory", imagePrompt: "A warehouse with music merchandise: t-shirts, posters, vinyl records on shelves" },
        { icon: ShoppingCart, labelKey: "nav.merchandise", path: "/merchandise", imagePrompt: "A merch table at a concert with t-shirts, hats, posters, and fans browsing" },
      ]}
    />
  );
}
