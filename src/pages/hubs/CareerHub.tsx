import { CategoryHub } from "@/components/CategoryHub";
import { Briefcase, DollarSign, Building2, Handshake, Disc, Sparkles, Megaphone, Building, Headphones, Scissors } from "lucide-react";

export default function CareerHub() {
  return (
    <CategoryHub
      titleKey="nav.career"
      description="Employment, finances, companies, labels, and PR."
      tiles={[
        { icon: Briefcase, labelKey: "nav.employment", path: "/employment", imagePrompt: "A job board with music industry positions: producer, roadie, DJ, sound engineer listings" },
        { icon: DollarSign, labelKey: "nav.finances", path: "/finances", imagePrompt: "A financial dashboard showing income charts, expenses, and gold coins stacking up" },
        { icon: Building2, labelKey: "nav.myCompanies", path: "/my-companies", imagePrompt: "A modern office building with a record label logo, music business empire" },
        { icon: Handshake, labelKey: "nav.sponsorships", path: "/sponsorships", imagePrompt: "A handshake between a musician and a corporate sponsor with brand logos and contracts" },
        { icon: Disc, labelKey: "nav.recordLabels", path: "/labels", imagePrompt: "A record label office with gold records on walls, vinyl pressing machines, and contracts" },
        { icon: Sparkles, labelKey: "nav.modeling", path: "/modeling", imagePrompt: "A fashion runway with a musician posing for cameras, flashbulbs and spotlights" },
        { icon: Scissors, labelKey: "nav.clothingDesigner", path: "/clothing-designer", imagePrompt: "A fashion design studio with clothing sketches, fabric swatches, and sewing machines" },
        { icon: Megaphone, labelKey: "nav.pr", path: "/pr", imagePrompt: "A PR agency office with press releases, magazine covers, and a megaphone" },
        { icon: Handshake, labelKey: "nav.offers", path: "/offers-dashboard", imagePrompt: "A desk covered with contract offers, pen, and decision-making documents" },
        { icon: Building, labelKey: "nav.venues", path: "/venues", imagePrompt: "A concert venue exterior with marquee sign showing tonight's performance" },
        { icon: Headphones, labelKey: "nav.producerCareer", path: "/producer-career", imagePrompt: "A music producer at a mixing console with headphones, creating beats in a studio" },
      ]}
    />
  );
}
