import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { GENRE_LIST } from "@/data/skillTree";
import type { TerritoryRow } from "./types";

interface CreateLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  territories: TerritoryRow[];
  personalBalance: number;
  minimumBalance: number;
}

export function CreateLabelDialog({
  open,
  onOpenChange,
  territories,
  personalBalance,
  minimumBalance,
}: CreateLabelDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [headquartersCity, setHeadquartersCity] = useState("");
  const [genreFocus, setGenreFocus] = useState("");
  const [rosterCapacity, setRosterCapacity] = useState(5);
  const [marketingBudget, setMarketingBudget] = useState(0);
  const [selectedTerritories, setSelectedTerritories] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const insufficientFunds = personalBalance < minimumBalance;
  const formattedPersonalBalance = useMemo(
    () => personalBalance.toLocaleString("en-US"),
    [personalBalance],
  );
  const formattedMinimumBalance = useMemo(
    () => minimumBalance.toLocaleString("en-US"),
    [minimumBalance],
  );

  const resetState = () => {
    setName("");
    setDescription("");
    setHeadquartersCity("");
    setGenreFocus("");
    setRosterCapacity(5);
    setMarketingBudget(0);
    setSelectedTerritories([]);
  };

  const toggleTerritory = (code: string) => {
    setSelectedTerritories((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  const handleSubmit = async () => {
    if (insufficientFunds) {
      toast({
        title: "Insufficient personal funds",
        description: `You need at least $${formattedMinimumBalance} in your personal balance to launch a label.`,
        variant: "destructive",
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: "Name is required",
        description: "Please provide a name for your label before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const parsedGenres = genreFocus ? [genreFocus] : [];

    const { data, error } = await supabase
      .from("labels")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        headquarters_city: headquartersCity.trim() || null,
        roster_slot_capacity: rosterCapacity,
        marketing_budget: marketingBudget,
        genre_focus: parsedGenres.length ? parsedGenres : null,
      })
      .select("id")
      .single();

    if (error) {
      toast({
        title: "Unable to create label",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (data?.id && selectedTerritories.length > 0) {
      const { error: territoryError } = await supabase.from("label_territories").insert(
        selectedTerritories.map((code) => ({
          label_id: data.id,
          territory_code: code,
        }))
      );

      if (territoryError) {
        toast({
          title: "Label created but territories failed",
          description: territoryError.message,
          variant: "destructive",
        });
      }
    }

    toast({
      title: "Label created",
      description: "Your label is ready to start signing artists.",
    });

    await queryClient.invalidateQueries({ queryKey: ["labels-directory"] });
    resetState();
    onOpenChange(false);
    setIsSubmitting(false);
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
          <DialogTitle>Create a new record label</DialogTitle>
          <DialogDescription>
            Establish a label identity, roster strategy, and target territories for your roster.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant={insufficientFunds ? "destructive" : "default"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {insufficientFunds ? (
                <span>
                  Launching a label is limited to players with at least ${formattedMinimumBalance} in personal funds. Your current balance is ${formattedPersonalBalance}.
                  Admins can also provision labels via the management tools without any fee.
                </span>
              ) : (
                <span>
                  You meet the personal balance requirement of ${formattedMinimumBalance}. Completing this form will register the label without additional costs.
                </span>
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="label-name">Label name</Label>
            <Input
              id="label-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Midnight Echo Records"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="label-city">Headquarters city</Label>
              <Input
                id="label-city"
                value={headquartersCity}
                onChange={(event) => setHeadquartersCity(event.target.value)}
                placeholder="Stockholm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label-genres">Genre focus</Label>
              <Select value={genreFocus} onValueChange={setGenreFocus}>
                <SelectTrigger id="label-genres" className="bg-background">
                  <SelectValue placeholder="Select a genre" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {GENRE_LIST.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label-description">Label manifesto</Label>
            <Textarea
              id="label-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Share your label vision, strengths, and artist development philosophy."
              rows={4}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="roster-capacity">Roster capacity</Label>
              <Input
                id="roster-capacity"
                type="number"
                min={1}
                value={rosterCapacity}
                onChange={(event) => setRosterCapacity(Number(event.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marketing-budget">Annual marketing budget</Label>
              <Input
                id="marketing-budget"
                type="number"
                min={0}
                value={marketingBudget}
                onChange={(event) => setMarketingBudget(Number(event.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Focus territories</Label>
            <ScrollArea className="h-40 rounded-md border p-3">
              <div className="space-y-2">
                {territories.map((territory) => (
                  <label key={territory.code} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedTerritories.includes(territory.code)}
                      onCheckedChange={() => toggleTerritory(territory.code)}
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

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || insufficientFunds}>
            {isSubmitting ? "Creating..." : "Create label"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
