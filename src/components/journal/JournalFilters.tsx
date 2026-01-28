import { JournalCategory } from "@/pages/Journal";
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  Mic,
  TrendingUp,
  Heart,
  Target,
  Sparkles,
  Users,
  Music,
  Grid,
} from "lucide-react";

interface JournalFiltersProps {
  category: JournalCategory;
  onCategoryChange: (category: JournalCategory) => void;
}

const categories: { value: JournalCategory; icon: typeof Star; labelKey: string }[] = [
  { value: "all", icon: Grid, labelKey: "common.all" },
  { value: "career", icon: Star, labelKey: "journal.category.career" },
  { value: "performance", icon: Mic, labelKey: "journal.category.performance" },
  { value: "chart", icon: TrendingUp, labelKey: "journal.category.chart" },
  { value: "fan", icon: Heart, labelKey: "journal.category.fan" },
  { value: "personal", icon: Sparkles, labelKey: "journal.category.personal" },
  { value: "goal", icon: Target, labelKey: "journal.category.goal" },
  { value: "memory", icon: Users, labelKey: "journal.category.memory" },
];

export const JournalFilters = ({ category, onCategoryChange }: JournalFiltersProps) => {
  const { t } = useTranslation();
  
  const getCategoryLabel = (cat: JournalCategory): string => {
    const labels: Record<JournalCategory, string> = {
      all: t("common.all", "All"),
      career: t("journal.category.career", "Career"),
      performance: t("journal.category.performance", "Performance"),
      chart: t("journal.category.chart", "Charts"),
      fan: t("journal.category.fan", "Fans"),
      personal: t("journal.category.personal", "Personal"),
      goal: t("journal.category.goal", "Goals"),
      memory: t("journal.category.memory", "Memories"),
    };
    return labels[cat] || cat;
  };

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isActive = category === cat.value;
        
        return (
          <Badge
            key={cat.value}
            variant={isActive ? "default" : "outline"}
            className={`cursor-pointer transition-all px-3 py-1 ${
              isActive 
                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                : "hover:bg-accent hover:text-accent-foreground"
            }`}
            onClick={() => onCategoryChange(cat.value)}
          >
            <Icon className="h-3 w-3 mr-1.5" />
            {getCategoryLabel(cat.value)}
          </Badge>
        );
      })}
    </div>
  );
};
