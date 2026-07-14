import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ProgressRing } from "./ProgressRing";

interface StatCardProps {
  label: string;
  value: number; // 0-100
  icon?: ReactNode;
  color?: string;
  className?: string;
}

export const StatCard = ({ label, value, icon, color, className }: StatCardProps) => (
  <div className={cn("rm-mcard p-3 flex items-center gap-3", className)}>
    <ProgressRing value={value} color={color} size={48} stroke={5}>
      {icon ?? <span className="text-[10px] font-bold">{Math.round(value)}</span>}
    </ProgressRing>
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[15px] font-semibold leading-tight">{Math.round(value)}%</div>
    </div>
  </div>
);
