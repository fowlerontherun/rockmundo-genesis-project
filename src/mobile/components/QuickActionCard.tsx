import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface QuickActionCardProps {
  label: string;
  icon: ReactNode;
  to?: string;
  onClick?: () => void;
  tint?: string; // Tailwind color like 'bg-primary/10 text-primary'
  className?: string;
}

export const QuickActionCard = ({ label, icon, to, onClick, tint, className }: QuickActionCardProps) => {
  const navigate = useNavigate();
  const handle = () => {
    if (onClick) onClick();
    else if (to) navigate(to);
  };
  return (
    <button
      type="button"
      onClick={handle}
      className={cn(
        "rm-mcard rm-tap p-3 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform",
        className,
      )}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center",
          tint ?? "bg-primary/10 text-primary",
        )}
      >
        {icon}
      </div>
      <div className="text-[11px] font-medium leading-tight text-center">{label}</div>
    </button>
  );
};
