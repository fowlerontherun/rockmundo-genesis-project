import { CategoryHub } from "@/components/CategoryHub";
import { Twitter, Video, Heart, HandHeart, UserPlus, Sparkles } from "lucide-react";

export default function SocialHub() {
  return (
    <CategoryHub
      titleKey="nav.social"
      description="Social media, relationships, and community."
      tiles={[
        { icon: Twitter, labelKey: "nav.twaater", path: "/twaater", imagePrompt: "A social media feed showing tweets, likes, and trending music topics on a phone screen" },
        { icon: Video, labelKey: "nav.dikcok", path: "/dikcok", imagePrompt: "A vertical video app showing viral music clips with hearts and comment bubbles" },
        { icon: Heart, labelKey: "nav.relationships", path: "/relationships", imagePrompt: "Two people connecting over music at a cafe, hearts and music notes floating between them" },
        { icon: HandHeart, labelKey: "nav.gettit", path: "/gettit", imagePrompt: "A Reddit-style forum with music discussion threads, upvotes, and community posts" },
        { icon: UserPlus, labelKey: "nav.playerSearch", path: "/players/search", imagePrompt: "A search interface showing musician profiles with instruments and genre tags" },
        { icon: Sparkles, labelKey: "nav.underworld", path: "/underworld", imagePrompt: "A dark underground club scene with mysterious lighting and shadowy figures dealing" },
      ]}
    />
  );
}
