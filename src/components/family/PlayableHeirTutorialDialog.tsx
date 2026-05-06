import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  Sparkles,
  Music,
  Users,
  Briefcase,
  Heart,
  Calendar,
  ArrowRight,
  Repeat,
  GraduationCap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heirName: string;
  /** Called after the user picks an action (or dismisses). */
  onComplete?: () => void;
}

interface NextAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  route: string;
}

const NEXT_ACTIONS: NextAction[] = [
  {
    icon: GraduationCap,
    label: "Train skills",
    description: "Spend starter AP and SXP at the studio or with mentors.",
    route: "/education",
  },
  {
    icon: Music,
    label: "Write a song",
    description: "Kick off your first project in the songwriting studio.",
    route: "/songwriting",
  },
  {
    icon: Users,
    label: "Form or join a band",
    description: "Recruit members or apply to an existing band.",
    route: "/band-recruitment",
  },
  {
    icon: Briefcase,
    label: "Find work",
    description: "Pick up a job to fund your early career.",
    route: "/work-booking",
  },
];

export function PlayableHeirTutorialDialog({ open, onOpenChange, heirName, onComplete }: Props) {
  const navigate = useNavigate();

  const handleAction = (route: string) => {
    onOpenChange(false);
    onComplete?.();
    navigate(route);
  };

  const handleStayOnDashboard = () => {
    onOpenChange(false);
    onComplete?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Crown className="h-5 w-5 text-social-chemistry" />
            Welcome, {heirName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            You're now playing a brand-new character. Here's what changed and what to do first.
          </p>

          {/* What changes */}
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                What changes
              </span>
              <Sparkles className="h-3.5 w-3.5 text-social-chemistry" />
            </div>
            <ul className="space-y-1.5 text-[11px] text-foreground/90">
              <li className="flex items-start gap-1.5">
                <Repeat className="h-3 w-3 mt-0.5 shrink-0 text-social-chemistry" />
                <span>
                  <span className="font-semibold">New active character:</span> bands, gigs, gear and
                  cash all swap to this heir. Your previous character keeps their progress and is
                  available from the slot switcher.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-social-chemistry" />
                <span>
                  <span className="font-semibold">Legacy bonuses:</span> inherited potentials and
                  bond translate into starter SXP/AP and trait modifiers.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Heart className="h-3 w-3 mt-0.5 shrink-0 text-social-chemistry" />
                <span>
                  <span className="font-semibold">Fresh relationships:</span> friendships, fans and
                  reputation start at zero — your parents are still family contacts.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Calendar className="h-3 w-3 mt-0.5 shrink-0 text-social-chemistry" />
                <span>
                  <span className="font-semibold">Clean schedule:</span> no jobs, tours or
                  rehearsals are auto-carried over. Block out your week from scratch.
                </span>
              </li>
            </ul>
          </div>

          {/* Next actions */}
          <div className="rounded-md border border-border/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Recommended next steps
              </span>
              <Badge variant="outline" className="text-[10px]">Optional</Badge>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {NEXT_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.route}
                    type="button"
                    onClick={() => handleAction(action.route)}
                    className="rounded-md border border-border/60 px-2 py-1.5 text-left text-[11px] hover:border-social-chemistry/60 hover:bg-social-chemistry/5 transition-colors flex items-center gap-2"
                  >
                    <Icon className="h-3.5 w-3.5 text-social-chemistry shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{action.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {action.description}
                      </div>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={handleStayOnDashboard}>
            Explore on my own
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
