import { ChefHat } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { CookingPractice } from "@/features/cooking/CookingPractice";
import { CookingRecipeBook } from "@/features/cooking/CookingRecipeBook";
import { CookingInventory } from "@/features/cooking/CookingInventory";
import { CookingLiveKitchen } from "@/features/cooking/CookingLiveKitchen";

export default function CookingCareer() {
  return <FMPageScaffold title="Cooking" eyebrow="Cooking career" icon={ChefHat}
    subtitle="Practise pan timing or prepare real food when local ingredients and recipes are available."
    backTo="/career" backLabel="Back to Career">
    <CookingLiveKitchen />
    <CookingPractice />
    <CookingRecipeBook />
    <CookingInventory />
  </FMPageScaffold>;
}
