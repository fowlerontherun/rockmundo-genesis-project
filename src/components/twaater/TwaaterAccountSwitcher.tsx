import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, User, Users } from "lucide-react";

interface TwaaterAccountSwitcherProps {
  currentAccount: {
    id: string;
    owner_type: string;
    display_name: string;
    handle: string;
  };
  onSwitch: (ownerType: "persona" | "band", ownerId: string) => void;
}

export const TwaaterAccountSwitcher = ({
  currentAccount,
  onSwitch,
}: TwaaterAccountSwitcherProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          {currentAccount.owner_type === "persona" ? (
            <User className="h-4 w-4" />
          ) : (
            <Users className="h-4 w-4" />
          )}
          {currentAccount.display_name}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Post as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2">
          <User className="h-4 w-4" />
          Personal Account
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" disabled>
          <Users className="h-4 w-4" />
          Band Accounts (Coming Soon)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
