import { CategoryHub } from "@/components/CategoryHub";
import {
  Users, Twitter, Video, HandHeart, MessageSquare, Sparkles, Dices,
  Ticket, Skull, Crown, Package, Star,
} from "lucide-react";

export default function SocialHub() {
  return (
    <CategoryHub
      titleKey="nav.social"
      description="People, peer platforms, nightlife, and premium goods."
      groups={[
        {
          label: "People",
          tiles: [
            { icon: Users, labelKey: "Social Hub", path: "/social", imagePrompt: "A unified social hub with friends list, chat windows, and party invites" },
            { icon: MessageSquare, labelKey: "Twaater Messages", path: "/twaater/messages", imagePrompt: "A direct messaging app with chat bubbles and a contact list" },
          ],
        },
        {
          label: "Platforms",
          tiles: [
            { icon: Twitter, labelKey: "nav.twaater", path: "/twaater", imagePrompt: "A social media feed with tweets, likes, and trending music topics" },
            { icon: Video, labelKey: "nav.dikcok", path: "/dikcok", imagePrompt: "A vertical video app showing viral music clips with hearts and comments" },
            { icon: HandHeart, labelKey: "nav.gettit", path: "/gettit", imagePrompt: "A Reddit-style forum with music discussion threads and upvotes" },
          ],
        },
        {
          label: "Nightlife & Vice",
          tiles: [
            { icon: Sparkles, labelKey: "Nightclubs", path: "/nightclubs", imagePrompt: "A neon-lit nightclub with DJs, dancing crowds, and laser lights" },
            { icon: Dices, labelKey: "nav.casino", path: "/casino", imagePrompt: "A neon-lit casino floor with roulette wheels and slot machines" },
            { icon: Ticket, labelKey: "Lottery", path: "/lottery", imagePrompt: "A golden lottery ticket with sparkles and a spinning prize wheel" },
            { icon: Skull, labelKey: "nav.underworld", path: "/underworld", imagePrompt: "A dark underground club scene with mysterious lighting and shadowy figures" },
          ],
        },
        {
          label: "Premium",
          tiles: [
            { icon: Crown, labelKey: "In-Game Store", path: "/premium-store", tileImageKey: "premium-store", imagePrompt: "A premium in-game store with a glowing gold VIP crown and cosmetics" },
            { icon: Package, labelKey: "Blind Boxes", path: "/blind-boxes", imagePrompt: "Mystery blind boxes with sparkles, ready to be opened" },
            { icon: Star, labelKey: "VIP Subscribe", path: "/vip-subscribe", imagePrompt: "A VIP subscription card with gold accents and premium perks listed" },
          ],
        },
      ]}
    />
  );
}
