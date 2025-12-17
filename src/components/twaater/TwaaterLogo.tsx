import { cn } from "@/lib/utils";

interface TwaaterLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export const TwaaterLogo = ({ className, size = "md", showText = true }: TwaaterLogoProps) => {
  const sizes = {
    sm: { icon: 20, text: "text-lg" },
    md: { icon: 28, text: "text-xl" },
    lg: { icon: 40, text: "text-3xl" },
  };

  const { icon, text } = sizes[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="twaaterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(270, 80%, 70%)" />
            <stop offset="100%" stopColor="hsl(270, 80%, 55%)" />
          </linearGradient>
        </defs>
        {/* Bird body */}
        <path
          d="M28 8c-1.5 0.7-3 1.1-4.6 1.3 1.6-1 2.9-2.6 3.5-4.5-1.5 0.9-3.2 1.6-5 1.9C20.4 5.2 18.5 4 16.3 4c-4.1 0-7.4 3.3-7.4 7.4 0 0.6 0.1 1.2 0.2 1.7C6 12.9 3.2 10.1 1.3 6.5c-0.6 1.1-1 2.4-1 3.8 0 2.6 1.3 4.8 3.3 6.2-1.2 0-2.4-0.4-3.4-0.9v0.1c0 3.6 2.5 6.5 5.9 7.2-0.6 0.2-1.3 0.3-2 0.3-0.5 0-0.9 0-1.4-0.1 0.9 2.9 3.6 5 6.8 5.1-2.5 2-5.6 3.1-9 3.1-0.6 0-1.2 0-1.7-0.1 3.2 2 7 3.2 11.1 3.2 13.3 0 20.6-11 20.6-20.6 0-0.3 0-0.6 0-0.9 1.4-1 2.6-2.3 3.6-3.7z"
          fill="url(#twaaterGradient)"
        />
        {/* Music note overlay */}
        <circle cx="22" cy="20" r="3" fill="hsl(270, 80%, 80%)" opacity="0.9" />
        <rect x="24" y="12" width="2" height="8" rx="1" fill="hsl(270, 80%, 80%)" opacity="0.9" />
        <path d="M25 12 C25 12 28 10 28 13" stroke="hsl(270, 80%, 80%)" strokeWidth="1.5" fill="none" opacity="0.9" />
      </svg>
      {showText && (
        <span
          className={cn("font-bold", text)}
          style={{
            background: "linear-gradient(135deg, hsl(270, 80%, 70%), hsl(270, 80%, 55%))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Twaater
        </span>
      )}
    </div>
  );
};
