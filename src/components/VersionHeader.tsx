import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import { VipBadge } from "@/components/VipBadge";

export const VersionHeader = () => {
  const { t } = useTranslation();
  const version = "1.0.155";
  
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
        {t('beta')}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {t('version')}: {version}
      </span>
      <VipBadge size="sm" />
    </div>
  );
};
