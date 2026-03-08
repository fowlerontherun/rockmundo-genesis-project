import { CategoryHub } from "@/components/CategoryHub";
import { Briefcase, DollarSign, Building2, Handshake, Disc, Sparkles, Megaphone, Building, Headphones, Scissors, Store, ShoppingCart } from "lucide-react";

export default function CareerBusinessHub() {
  return (
    <CategoryHub
      titleKey="nav.careerBusiness"
      description="Employment, finances, companies, labels, merchandise, and more."
      tiles={[
        { icon: Briefcase, labelKey: "nav.employment", path: "/employment" },
        { icon: DollarSign, labelKey: "nav.finances", path: "/finances" },
        { icon: Building2, labelKey: "nav.myCompanies", path: "/my-companies" },
        { icon: Handshake, labelKey: "nav.sponsorships", path: "/sponsorships" },
        { icon: Disc, labelKey: "nav.recordLabels", path: "/labels" },
        { icon: Sparkles, labelKey: "nav.modeling", path: "/modeling" },
        { icon: Scissors, labelKey: "nav.clothingDesigner", path: "/clothing-designer" },
        { icon: Megaphone, labelKey: "nav.pr", path: "/pr" },
        { icon: Handshake, labelKey: "nav.offers", path: "/offers-dashboard" },
        { icon: Building, labelKey: "nav.venues", path: "/venues" },
        { icon: Headphones, labelKey: "nav.producerCareer", path: "/producer-career" },
        { icon: Store, labelKey: "nav.inventory", path: "/inventory" },
        { icon: ShoppingCart, labelKey: "nav.merchandise", path: "/merchandise" },
      ]}
    />
  );
}
