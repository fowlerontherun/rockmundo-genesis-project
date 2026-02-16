import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import type { LucideIcon } from "lucide-react";

interface HubTile {
  icon: LucideIcon;
  labelKey: string;
  path: string;
  description?: string;
}

interface CategoryHubProps {
  titleKey: string;
  description?: string;
  tiles: HubTile[];
}

export const CategoryHub = ({ titleKey, description, tiles }: CategoryHubProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{t(titleKey)}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Card
              key={tile.path}
              className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
              onClick={() => navigate(tile.path)}
            >
              <CardContent className="flex flex-col items-center justify-center text-center p-6 gap-3">
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <span className="text-sm font-medium">{t(tile.labelKey)}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
