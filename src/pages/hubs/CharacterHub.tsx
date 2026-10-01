import { CategoryHub } from "@/components/CategoryHub";
import {
  User, Users, ShoppingCart, Guitar, HeartPulse, History, BookOpen, GraduationCap, Sparkles,
  Palette, Skull, Crown, Scissors, Package, Home, Car, Heart,
} from "lucide-react";

export default function CharacterHub() {
  return (
    <CategoryHub
      titleKey="nav.character"
      description="Identity, property, relationships, and legacy."
      groups={[
        {
          label: "Identity",
          tiles: [
            { icon: Users, labelKey: "nav.characters", path: "/characters", tileImageKey: "buy-character-slot", imagePrompt: "A character roster screen with multiple punk avatars and stats cards" },
            { icon: User, labelKey: "nav.avatar", path: "/avatar-designer", imagePrompt: "A character customization screen with a rock star avatar and clothing options" },
            { icon: ShoppingCart, labelKey: "nav.skinStore", path: "/skin-store", imagePrompt: "A colorful shop displaying character skins, outfits, and accessories" },
            { icon: Palette, labelKey: "nav.tattooParlour", path: "/tattoo-parlour", imagePrompt: "A tattoo parlour with flash art on walls and rock-themed designs" },
            { icon: Scissors, labelKey: "nav.clothingShop", path: "/clothing-shop", imagePrompt: "A boutique clothing shop with stage outfits and racks of rock fashion" },
          ],
        },
        {
          label: "Progression",
          tiles: [
            { icon: Sparkles, labelKey: "nav.skills", path: "/skills", imagePrompt: "A personal progression screen with branching music skill trees, XP meters, and practice plans" },
            { icon: GraduationCap, labelKey: "nav.education", path: "/education", imagePrompt: "A music school classroom with instruments, chalkboard, and students" },
            { icon: HeartPulse, labelKey: "nav.wellness", path: "/wellness", imagePrompt: "A wellness dashboard showing health and energy meters with a spa scene" },
          ],
        },
        {
          label: "Property",
          tiles: [
            { icon: Guitar, labelKey: "nav.gear", path: "/gear", imagePrompt: "A collection of instruments: electric guitar, bass, drums, keyboard" },
            { icon: Package, labelKey: "nav.inventory", path: "/inventory", imagePrompt: "A warehouse with merchandise stacked on shelves" },
            { icon: Home, labelKey: "Housing", path: "/housing", imagePrompt: "A cozy musician apartment with posters, instruments, and city view" },
            { icon: Car, labelKey: "Personal Vehicles", path: "/personal-vehicles", imagePrompt: "A stylish garage with a luxury car and a custom motorbike under neon lights" },
          ],
        },
        {
          label: "Legacy",
          tiles: [
            { icon: Heart, labelKey: "Family", path: "/family/timeline", imagePrompt: "A family tree timeline showing children, spouse, and generational milestones" },
            { icon: History, labelKey: "nav.statistics", path: "/statistics", imagePrompt: "An infographic dashboard showing career statistics and milestones" },
            { icon: BookOpen, labelKey: "nav.legacy", path: "/legacy", imagePrompt: "A hall of fame book showing a musician's legendary career timeline" },
            { icon: Skull, labelKey: "nav.hallOfImmortals", path: "/hall-of-immortals", imagePrompt: "A dark memorial hall with ghostly portraits of fallen rock stars" },
            { icon: Crown, labelKey: "In-Game Store", path: "/premium-store", tileImageKey: "premium-store", imagePrompt: "An elegant premium in-game store with a glowing gold VIP crown" },
          ],
        },
      ]}
    />
  );
}
