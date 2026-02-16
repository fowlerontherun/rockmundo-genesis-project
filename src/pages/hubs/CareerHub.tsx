import { CategoryHub } from "@/components/CategoryHub";
import { Briefcase, DollarSign, Building2, Handshake, Disc, Sparkles, Megaphone, Building } from "lucide-react";

export default function CareerHub() {
  return (
    <CategoryHub
      titleKey="nav.career"
      description="Employment, finances, companies, labels, and PR."
      tiles={[
        { icon: Briefcase, labelKey: "nav.employment", path: "/employment" },
        { icon: DollarSign, labelKey: "nav.finances", path: "/finances" },
        { icon: Building2, labelKey: "nav.myCompanies", path: "/my-companies" },
        { icon: Handshake, labelKey: "nav.sponsorships", path: "/sponsorships" },
        { icon: Disc, labelKey: "nav.recordLabels", path: "/labels" },
        { icon: Sparkles, labelKey: "nav.modeling", path: "/modeling" },
        { icon: Megaphone, labelKey: "nav.pr", path: "/pr" },
        { icon: Handshake, labelKey: "nav.offers", path: "/offers-dashboard" },
        { icon: Building, labelKey: "nav.venues", path: "/venues" },
      ]}
    />
  );
}
