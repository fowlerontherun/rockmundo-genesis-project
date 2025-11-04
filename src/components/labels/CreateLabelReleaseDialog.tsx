import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import type { ContractWithRelations, TerritoryRow } from "./types";

interface CreateLabelReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: ContractWithRelations[];
  territories: TerritoryRow[];
}

const RELEASE_TYPES = [
  { value: "single", label: "Single" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Album" },
  { value: "live", label: "Live" },
];

export function CreateLabelReleaseDialog({
  open,
  onOpenChange,
  contracts,
  territories,
}: CreateLabelReleaseDialogProps) {
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [releaseType, setReleaseType] = useState<string>("single");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [promotionBudget, setPromotionBudget] = useState<number>(5000);
  const [mastersCost, setMastersCost] = useState<number>(0);
  const [selectedTerritories, setSelectedTerritories] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const contractOptions = useMemo(() => contracts.filter((contract) => contract.status !== "terminated"), [contracts]);

  const handleToggleTerritory = (code: string) => {
    setSelectedTerritories((prev) =>
      prev.includes(code) ? prev.filter((value) => value !== code) : [...prev, code]
    );
  };

  const resetState = () => {
    setSelectedContractId("");
    setTitle("");
    setReleaseType("single");
    setScheduledDate("");
    setPromotionBudget(5000);
    setMastersCost(0);
    setSelectedTerritories([]);
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!selectedContractId || !title.trim()) {
      toast({
        title: "Missing details",
        description: "Please select a contract and provide a release title.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from("label_releases").insert({
      contract_id: selectedContractId,
      title: title.trim(),
      release_type: releaseType,
      scheduled_date: scheduledDate || null,
      promotion_budget: promotionBudget,
      masters_cost: mastersCost,
      territory_strategy: selectedTerritories,
      status: "planning",
      notes: notes.trim() || null,
    });

    if (error) {
      toast({
        title: "Could not create release",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    toast({
      title: "Release planned",
      description: "Your release has been added to the pipeline.",
    });

    await queryClient.invalidateQueries({ queryKey: ["label-releases"] });
    await queryClient.invalidateQueries({ queryKey: ["label-contracts"] });

    setIsSubmitting(false);
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          resetState();
        }
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Plan a new release</DialogTitle>
          <DialogDescription>
            Connect a new single, EP, or album to a signed contract and sync with your promotion roadmap.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Contract</Label>
            <Select value={selectedContractId} onValueChange={setSelectedContractId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a label partnership" />
              </SelectTrigger>
              <SelectContent>
                {contractOptions.map((contract) => (
                  <SelectItem key={contract.id} value={contract.id}>
                    {contract.labels?.name ?? "Label"} · {contract.royalty_artist_pct}% artist share
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="release-title">Release title</Label>
            <Input
              id="release-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Neon Skyline"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={releaseType} onValueChange={setReleaseType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELEASE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled-date">Scheduled release date</Label>
              <Input
                id="scheduled-date"
                type="date"
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promotion-budget">Promotion budget</Label>
              <Input
                id="promotion-budget"
                type="number"
                min={0}
                value={promotionBudget}
                onChange={(event) => setPromotionBudget(Number(event.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="masters-cost">Masters cost</Label>
              <Input
                id="masters-cost"
                type="number"
                min={0}
                value={mastersCost}
                onChange={(event) => setMastersCost(Number(event.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Territory rollout</Label>
              <ScrollArea className="h-32 rounded-md border p-2">
                <div className="space-y-2 text-sm">
                  {territories.map((territory) => (
                    <label key={territory.code} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedTerritories.includes(territory.code)}
                        onCheckedChange={() => handleToggleTerritory(territory.code)}
                      />
                      <span>
                        {territory.name}
                        {territory.region ? <span className="text-muted-foreground"> · {territory.region}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="release-notes">Campaign notes</Label>
            <Textarea
              id="release-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Outline lead single plan, teaser schedule, or touring tie-ins."
            />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Planning..." : "Plan release"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
