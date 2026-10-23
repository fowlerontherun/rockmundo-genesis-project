import { ChefHat } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { CookingPractice } from "@/features/cooking/CookingPractice";
import { CookingTechniquePractice } from "@/features/cooking/CookingTechniquePractice";
import { CookingLiveTechniques } from "@/features/cooking/CookingLiveTechniques";
import { CookingRecipeBook } from "@/features/cooking/CookingRecipeBook";
import { CookingInventory } from "@/features/cooking/CookingInventory";
import { CookingLiveKitchen } from "@/features/cooking/CookingLiveKitchen";
import { CookingCityMarket } from "@/features/cooking/CookingCityMarket";
import { CookingPlayerStalls } from "@/features/cooking/CookingPlayerStalls";
import { CookingStallHistory } from "@/features/cooking/CookingStallHistory";
import { CookingRecipeShoppingList } from "@/features/cooking/CookingRecipeShoppingList";

export default function CookingCareer() {
  return <FMPageScaffold title="Cooking" eyebrow="Cooking career" icon={ChefHat}
    subtitle="Practise pan timing or prepare real food when local ingredients and recipes are available."
    backTo="/career" backLabel="Back to Career">
    <CookingCityMarket />
    <CookingPlayerStalls />
    <CookingStallHistory />
    <CookingRecipeShoppingList />
    <CookingLiveKitchen />
    <CookingLiveTechniques />
    <CookingPractice />
    <CookingTechniquePractice />
    <CookingRecipeBook />
    <CookingInventory />
  </FMPageScaffold>;
}
