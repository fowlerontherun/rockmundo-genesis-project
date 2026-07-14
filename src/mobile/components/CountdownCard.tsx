import { useEffect, useState, ReactNode } from "react";
import { MCard } from "./MCard";
import { Clock } from "lucide-react";

interface CountdownCardProps {
  title: string;
  subtitle?: string;
  target: string | Date | null;
  onPress?: () => void;
  icon?: ReactNode;
}

function fmt(ms: number) {
  if (ms <= 0) return "Ready";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export const CountdownCard = ({ title, subtitle, target, onPress, icon }: CountdownCardProps) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return null;
  const t = typeof target === "string" ? new Date(target).getTime() : target.getTime();
  const remaining = t - now;
  return (
    <MCard
      title={title}
      subtitle={subtitle}
      icon={icon ?? <Clock className="h-5 w-5" />}
      onPress={onPress}
      chevron={!!onPress}
      right={
        <div className="text-right">
          <div className="text-[10px] uppercase text-muted-foreground">Remaining</div>
          <div className="text-[15px] font-bold tabular-nums text-primary">{fmt(remaining)}</div>
        </div>
      }
    />
  );
};
