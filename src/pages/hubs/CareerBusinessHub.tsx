import { CategoryHub } from "@/components/CategoryHub";
import {
  Briefcase, DollarSign, Building2, Handshake, Disc, Sparkles, Megaphone,
  Building, Headphones, Scissors, ShoppingCart, GraduationCap, BookOpen, Film, Heart, Landmark,
} from "lucide-react";

export default function CareerBusinessHub() {
  return (
    <CategoryHub
      titleKey="nav.careerBusiness"
      description="Money, work, creative side-careers, and the companies you run."
      groups={[
        {
          label: "Money",
          tiles: [
            { icon: DollarSign, labelKey: "nav.finances", path: "/finances", imagePrompt: "A financial dashboard showing income charts, expenses, and gold coins" },
            { icon: Handshake, labelKey: "nav.sponsorships", path: "/sponsorships", imagePrompt: "A handshake between a musician and a corporate sponsor with brand logos" },
            { icon: Handshake, labelKey: "nav.offers", path: "/offers-dashboard", imagePrompt: "A desk covered with contract offers, pen, and decision-making documents" },
            { icon: Heart, labelKey: "Charity", path: "/finances?tab=charity", tileImageKey: "charity", imagePrompt: "A charity gala event with musicians performing on stage for a fundraiser" },
            { icon: Landmark, labelKey: "City Treasury", path: "/finances?tab=city", tileImageKey: "city-treasury", imagePrompt: "A city hall treasury vault with gold coins and ledgers" },
          ],
        },
        {
          label: "Work & Learn",
          tiles: [
            { icon: Briefcase, labelKey: "nav.employment", path: "/employment", imagePrompt: "A job board with music industry positions: producer, roadie, DJ, sound engineer" },
            { icon: GraduationCap, labelKey: "nav.education", path: "/education", imagePrompt: "A music school classroom with instruments, chalkboard, and students" },
            { icon: BookOpen, labelKey: "nav.teaching", path: "/teaching", imagePrompt: "A music teacher in front of students with a guitar and music theory board" },
          ],
        },
        {
          label: "Creative Industries",
          tiles: [
            { icon: Megaphone, labelKey: "nav.pr", path: "/pr", imagePrompt: "A PR agency office with press releases, magazine covers, and a megaphone" },
            { icon: Headphones, labelKey: "nav.producerCareer", path: "/producer-career", imagePrompt: "A music producer at a mixing console with headphones, creating beats" },
            { icon: Sparkles, labelKey: "nav.modeling", path: "/modeling", imagePrompt: "A fashion runway with a musician posing for cameras and flashbulbs" },
            { icon: Film, labelKey: "Acting", path: "/acting", imagePrompt: "A film set with a musician acting in a scene, cameras and crew around" },
            { icon: Scissors, labelKey: "nav.clothingDesigner", path: "/clothing-designer", imagePrompt: "A fashion design studio with clothing sketches, fabric swatches, sewing machines" },
          ],
        },
        {
          label: "Companies",
          tiles: [
            { icon: Building2, labelKey: "nav.myCompanies", path: "/my-companies", imagePrompt: "A modern office building with a record label logo, music business empire" },
            { icon: Disc, labelKey: "nav.recordLabels", path: "/labels", imagePrompt: "A record label office with gold records on walls and vinyl pressing machines" },
            { icon: Building, labelKey: "nav.venues", path: "/venues", imagePrompt: "A concert venue exterior with marquee sign showing tonight's performance" },
            { icon: ShoppingCart, labelKey: "nav.merchandise", path: "/merchandise", imagePrompt: "A merch table at a concert with t-shirts, hats, posters, and fans browsing" },
          ],
        },
      ]}
    />
  );
}
