import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import { VipBadge } from "@/components/VipBadge";
import { RMRadioButton } from "@/components/radio/RMRadioPlayer";

export const version = "1.0.617";

export const VersionHeader = () => {
  const { t } = useTranslation();
  
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px] px-1.5 py-0">
        {t('nav.beta')}
      </Badge>
      <span className="text-xs text-muted-foreground">
        v{version}
      </span>
      <VipBadge size="sm" />
      <RMRadioButton />
    </div>
  );
};
