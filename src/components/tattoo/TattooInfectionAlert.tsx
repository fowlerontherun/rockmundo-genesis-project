import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { PlayerTattoo } from "@/data/tattooDesigns";

interface TattooInfectionAlertProps {
  tattoos: PlayerTattoo[];
  onTreat?: (tattooId: string) => void;
}

export const TattooInfectionAlert = ({ tattoos, onTreat }: TattooInfectionAlertProps) => {
  const navigate = useNavigate();
  const infected = tattoos.filter(t => t.is_infected);
  
  if (infected.length === 0) return null;

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <span className="font-semibold text-destructive">Tattoo Infection!</span>
        <Badge variant="destructive" className="text-xs">{infected.length} active</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        You have {infected.length} infected tattoo{infected.length > 1 ? 's' : ''}. 
        Each infection drains -5 health/day and reduces performance by -3%.
        Visit a hospital ($200) or wait 7 days for natural healing.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={() => navigate('/wellness')}>
          Visit Hospital
        </Button>
        {onTreat && infected.map(t => (
          <Button key={t.id} size="sm" variant="outline" onClick={() => onTreat(t.id)}>
            Treat ($200)
          </Button>
        ))}
      </div>
    </div>
  );
};
