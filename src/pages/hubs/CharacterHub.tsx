import { CategoryHub } from "@/components/CategoryHub";
import { User, ShoppingCart, Guitar, HeartPulse, History, BookOpen } from "lucide-react";

export default function CharacterHub() {
  return (
    <CategoryHub
      titleKey="nav.character"
      description="Manage your avatar, gear, wellness, and personal stats."
      tiles={[
        { icon: User, labelKey: "nav.avatar", path: "/avatar-designer" },
        { icon: ShoppingCart, labelKey: "nav.skinStore", path: "/skin-store" },
        { icon: Guitar, labelKey: "nav.gear", path: "/gear" },
        { icon: HeartPulse, labelKey: "nav.wellness", path: "/wellness" },
        { icon: History, labelKey: "nav.statistics", path: "/statistics" },
        { icon: BookOpen, labelKey: "nav.legacy", path: "/legacy" },
      ]}
    />
  );
}
