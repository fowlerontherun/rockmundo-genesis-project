import { CategoryHub } from "@/components/CategoryHub";
import { Twitter, Video, Heart, HandHeart, UserPlus, Sparkles } from "lucide-react";

export default function SocialHub() {
  return (
    <CategoryHub
      titleKey="nav.social"
      description="Social media, relationships, and community."
      tiles={[
        { icon: Twitter, labelKey: "nav.twaater", path: "/twaater" },
        { icon: Video, labelKey: "nav.dikcok", path: "/dikcok" },
        { icon: Heart, labelKey: "nav.relationships", path: "/relationships" },
        { icon: HandHeart, labelKey: "nav.gettit", path: "/gettit" },
        { icon: UserPlus, labelKey: "nav.playerSearch", path: "/players/search" },
        { icon: Sparkles, labelKey: "nav.underworld", path: "/underworld" },
      ]}
    />
  );
}
