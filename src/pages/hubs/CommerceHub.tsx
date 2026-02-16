import { CategoryHub } from "@/components/CategoryHub";
import { Store, ShoppingCart } from "lucide-react";

export default function CommerceHub() {
  return (
    <CategoryHub
      titleKey="nav.commerce"
      description="Inventory and merchandise management."
      tiles={[
        { icon: Store, labelKey: "nav.inventory", path: "/inventory" },
        { icon: ShoppingCart, labelKey: "nav.merchandise", path: "/merchandise" },
      ]}
    />
  );
}
