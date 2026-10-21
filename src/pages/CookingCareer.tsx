import { ChefHat } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { CookingPractice } from "@/features/cooking/CookingPractice";

export default function CookingCareer() {
  return <FMPageScaffold title="Cooking" eyebrow="Practice kitchen" icon={ChefHat}
    subtitle="Learn to time your ingredients, control the heat and plate a perfectly cooked dish."
    backTo="/career" backLabel="Back to Career">
    <CookingPractice />
  </FMPageScaffold>;
}
