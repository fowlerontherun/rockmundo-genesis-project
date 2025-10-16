import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Theme = "nightfall" | "sunrise";

export const ThemeSwitcher = () => {
  const [theme, setTheme] = useState<Theme>("nightfall");

  useEffect(() => {
    const savedTheme = localStorage.getItem("rockmundo-theme") as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const switchTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("rockmundo-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change color scheme">
          <Palette className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => switchTheme("nightfall")}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[hsl(197,88%,60%)]" />
            <span>Nightfall (Default)</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => switchTheme("sunrise")}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[hsl(24,95%,58%)]" />
            <span>Sunrise</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
