import { Users, ChevronDown, Plus, Crown } from "lucide-react";
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
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

export function CharacterSwitcher() {
  const { slots, characters, switchCharacter } = useCharacterSlots();
  const navigate = useNavigate();
  const { toast } = useToast();

  const activeChar = characters.find((c) => c.is_active);

  if (!activeChar || characters.length <= 1) {
    // Don't show switcher if only 1 character
    return null;
  }

  const handleSwitch = async (profileId: string) => {
    if (profileId === activeChar?.id) return;
    try {
      await switchCharacter.mutateAsync(profileId);
      toast({ title: "Character switched", description: "Reloading..." });
      // Force full reload to reset all game state
      window.location.reload();
    } catch {
      toast({ title: "Error", description: "Failed to switch character", variant: "destructive" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={activeChar.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-primary/20">
              {(activeChar.display_name || activeChar.username || "?")[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline text-xs max-w-[80px] truncate">
            {activeChar.display_name || activeChar.username}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> Characters
          </span>
          {slots && (
            <Badge variant="outline" className="text-[10px] px-1.5">
              {slots.usedSlots}/{slots.maxSlots} slots
            </Badge>
          )}
        </div>
        <DropdownMenuSeparator />
        {characters.map((char) => (
          <DropdownMenuItem
            key={char.id}
            onClick={() => handleSwitch(char.id)}
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
                {char.display_name || char.username || "Unnamed"}
              </div>
              <div className="text-xs text-muted-foreground">
                Lv.{char.level} • {(char.fame || 0).toLocaleString()} fame
              </div>
            </div>
            {char.is_active && (
              <Badge className="text-[10px] px-1.5 bg-primary/20 text-primary border-primary/30">
                Active
              </Badge>
            )}
            {char.generation_number > 1 && (
              <Badge variant="outline" className="text-[10px] px-1">
                Gen {char.generation_number}
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
        {slots?.canCreateNew && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate("/onboarding")}
              className="gap-2 cursor-pointer text-primary"
            >
              <Plus className="h-4 w-4" />
              <span>New Character</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
