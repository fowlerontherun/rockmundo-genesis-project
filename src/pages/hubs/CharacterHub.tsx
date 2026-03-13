import { CategoryHub } from "@/components/CategoryHub";
import { User, ShoppingCart, Guitar, HeartPulse, History, BookOpen, Palette, Skull, UserPlus, Users } from "lucide-react";

export default function CharacterHub() {
  return (
    <CategoryHub
      titleKey="nav.character"
      description="Manage your avatar, gear, wellness, and personal stats."
      tiles={[
        { icon: Users, labelKey: "nav.characters", path: "/characters", imagePrompt: "A character roster screen with multiple punk avatars, stats cards, and a switch active character button" },
        { icon: User, labelKey: "nav.avatar", path: "/avatar-designer", imagePrompt: "A character customization screen with a rock star avatar and clothing/hair options" },
        { icon: ShoppingCart, labelKey: "nav.skinStore", path: "/skin-store", imagePrompt: "A colorful shop displaying character skins, outfits, and accessories for purchase" },
        { icon: Guitar, labelKey: "nav.gear", path: "/gear", imagePrompt: "A collection of instruments: electric guitar, bass, drums, keyboard, all gleaming" },
        { icon: HeartPulse, labelKey: "nav.wellness", path: "/wellness", imagePrompt: "A wellness dashboard showing health, energy, and happiness meters with a relaxing spa scene" },
        { icon: Palette, labelKey: "nav.tattooParlour", path: "/tattoo-parlour", imagePrompt: "A tattoo parlour with flash art on walls, tattoo machine, and rock-themed designs" },
        { icon: History, labelKey: "nav.statistics", path: "/statistics", imagePrompt: "An infographic dashboard showing career statistics, charts, and achievement milestones" },
        { icon: BookOpen, labelKey: "nav.legacy", path: "/legacy", imagePrompt: "A hall of fame book showing a musician's legendary career timeline and achievements" },
        { icon: Skull, labelKey: "nav.hallOfImmortals", path: "/hall-of-immortals", imagePrompt: "A dark memorial hall with ghostly portraits of fallen rock stars, candles, and flowers" },
      ]}
    />
  );
}
