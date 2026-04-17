import { Button } from "@/components/ui/button";
import { useSecondNomination } from "@/hooks/useNominations";
import { Handshake } from "lucide-react";

export function SecondNominationButton({ candidateId }: { candidateId: string }) {
  const second = useSecondNomination();
  return (
    <Button size="sm" variant="secondary" onClick={() => second.mutate(candidateId)} disabled={second.isPending}>
      <Handshake className="h-4 w-4 mr-1" /> Second
    </Button>
  );
}
