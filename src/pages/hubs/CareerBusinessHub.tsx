import { CategoryHub } from "@/components/CategoryHub";
import { Briefcase, DollarSign, Building2, Handshake, Disc, Sparkles, Megaphone, Building, Headphones, Scissors, Store, ShoppingCart, Heart, Landmark, Flag, Vote, Trophy } from "lucide-react";

export default function CareerBusinessHub() {
  return (
    <CategoryHub
      titleKey="nav.careerBusiness"
      description="Employment, finances, companies, labels, merchandise, and more."
      groups={[
        {
          label: "Career",
          tiles: [
            { icon: Briefcase, labelKey: "nav.employment", path: "/employment", imagePrompt: "A job board with music industry positions: producer, roadie, DJ, sound engineer listings" },
            { icon: DollarSign, labelKey: "nav.finances", path: "/finances", imagePrompt: "A financial dashboard showing income charts, expenses, and gold coins stacking up" },
            { icon: Building2, labelKey: "nav.myCompanies", path: "/my-companies", imagePrompt: "A modern office building with a record label logo, music business empire" },
            { icon: Handshake, labelKey: "nav.sponsorships", path: "/sponsorships", imagePrompt: "A handshake between a musician and a corporate sponsor with brand logos and contracts" },
            { icon: Disc, labelKey: "nav.recordLabels", path: "/labels", imagePrompt: "A record label office with gold records on walls, vinyl pressing machines, and contracts" },
            { icon: Heart, labelKey: "Charity", path: "/finances?tab=charity", tileImageKey: "charity", imagePrompt: "A charity gala event with musicians performing on stage for a fundraiser" },
            { icon: Landmark, labelKey: "City Treasury", path: "/finances?tab=city", tileImageKey: "city-treasury", imagePrompt: "A city hall treasury vault with gold coins, tax ledgers, and budget charts" },
          ],
        },
        {
          label: "Creative Industries",
          tiles: [
            { icon: Sparkles, labelKey: "nav.modeling", path: "/modeling", imagePrompt: "A fashion runway with a musician posing for cameras, flashbulbs and spotlights" },
            { icon: Scissors, labelKey: "nav.clothingDesigner", path: "/clothing-designer", imagePrompt: "A fashion design studio with clothing sketches, fabric swatches, and sewing machines" },
            { icon: Megaphone, labelKey: "nav.pr", path: "/pr", imagePrompt: "A PR agency office with press releases, magazine covers, and a megaphone" },
            { icon: Headphones, labelKey: "nav.producerCareer", path: "/producer-career", imagePrompt: "A music producer at a mixing console with headphones, creating beats in a studio" },
          ],
        },
        {
          label: "Business",
          tiles: [
            { icon: Handshake, labelKey: "nav.offers", path: "/offers-dashboard", imagePrompt: "A desk covered with contract offers, pen, and decision-making documents" },
            { icon: Building, labelKey: "nav.venues", path: "/venues", imagePrompt: "A concert venue exterior with marquee sign showing tonight's performance" },
            { icon: Store, labelKey: "nav.inventory", path: "/inventory", imagePrompt: "A warehouse with music merchandise: t-shirts, posters, vinyl records on shelves" },
            { icon: ShoppingCart, labelKey: "nav.merchandise", path: "/merchandise", imagePrompt: "A merch table at a concert with t-shirts, hats, posters, and fans browsing" },
          ],
        },
      ]}
    />
  );
}
