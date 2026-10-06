import { useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Users, ChevronDown, Plus, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";
import { useGameData } from "@/hooks/useGameData";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

export function CharacterSwitcher({ mobile = false }: { mobile?: boolean }) {
  const { t } = useTranslation();
  const [switching, setSwitching] = useState(false);
  const switchLock = useRef(false);
  const { slots, characters, switchCharacter } = useCharacterSlots();
  const { refetch: refetchGameData } = useGameData();
  const navigate = useNavigate();
  const { toast } = useToast();

  const activeChar = characters.find((c) => c.is_active);

  if (!activeChar || (!mobile && characters.length <= 1)) {
    // Don't show switcher if only 1 character
    return null;
  }

  const handleSwitch = async (profileId: string) => {
    if (profileId === activeChar?.id || switchLock.current) return;
    switchLock.current = true;
    setSwitching(true);
    try {
      await switchCharacter.mutateAsync(profileId);
      await refetchGameData();
      toast({ title: t("playerControls.switched"), description: t("playerControls.updated") });
      navigate(mobile ? "/mobile" : "/home", { replace: true });
    } catch {
      toast({ title: t("common.error"), description: t("playerControls.switchFailed"), variant: "destructive" });
    } finally {
      switchLock.current = false;
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={switching} aria-label={t(switching ? "playerControls.switching" : "playerControls.switchCharacter")} className="gap-1.5 px-1 shrink-0 h-10">
          <Avatar className={mobile ? "h-8 w-8" : "h-6 w-6"}>
            <AvatarImage src={activeChar.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-primary/20">
              {(activeChar.display_name || activeChar.username || "?")[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className={mobile ? "hidden" : "hidden sm:inline text-xs max-w-[80px] truncate"}>
            {activeChar.display_name || activeChar.username}
          </span>
          {switching ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={mobile ? "start" : "end"} collisionPadding={8} className="z-[80] w-64 max-w-[calc(100vw-1rem)] max-h-[65dvh] overflow-y-auto">
        <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {t("nav.characters")}
          </span>
          {slots && (
            <Badge variant="outline" className="text-[10px] px-1.5">
              {slots.usedSlots}/{slots.maxSlots} {t("playerControls.slots")}
            </Badge>
          )}
        </div>
        <DropdownMenuSeparator />
        {characters.map((char) => (
          <DropdownMenuItem
            key={char.id}
            disabled={switching || char.id === activeChar.id}
            onSelect={() => void handleSwitch(char.id)}
            className="gap-2 cursor-pointer"
          >
            <Avatar className="h-7 w-7">
              <AvatarImage src={char.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {(char.display_name || char.username || "?")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate font-medium">
                {char.display_name || char.username || t("playerControls.unnamed")}
              </div>
              <div className="text-xs text-muted-foreground">
                {char.died_at ? t("playerControls.coma") : `Lv.${char.level} • ${(char.fame || 0).toLocaleString()} ${t("playerControls.fame")}`}
              </div>
            </div>
            {char.is_active && (
              <Badge className="text-[10px] px-1.5 bg-primary/20 text-primary border-primary/30">
                {t("playerControls.active")}
              </Badge>
            )}
            {char.died_at && (
              <Badge variant="outline" className="text-[10px] px-1 border-primary/40 text-primary">
                {t("playerControls.revive")}
              </Badge>
            )}
            {char.generation_number > 1 && (
              <Badge variant="outline" className="text-[10px] px-1">
                {t("playerControls.generation")} {char.generation_number}
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
        {slots?.canCreateNew && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate("/characters/new")}
              className="gap-2 cursor-pointer text-primary"
            >
              <Plus className="h-4 w-4" />
              <span>{t("playerControls.newCharacter")}</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
