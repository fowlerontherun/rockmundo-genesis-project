import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { useCreateParty, useParties } from "@/hooks/useParties";
import { SUGGESTED_PARTY_COLOURS, PARTY_FOUNDING_COST } from "@/types/political-party";
import { ColourPicker } from "./ColourPicker";

interface Props {
  onCreated?: () => void;
}

export function PartyCreateWizard({ onCreated }: Props) {
  const { data: parties } = useParties();
  const create = useCreateParty();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colour, setColour] = useState(SUGGESTED_PARTY_COLOURS[0]);
  const [beliefs, setBeliefs] = useState<[string, string, string, string, string]>(["", "", "", "", ""]);

  const usedColours = useMemo(
    () => new Set((parties ?? []).map((p) => p.colour_hex.toLowerCase())),
    [parties]
  );

  const canSubmit =
    name.trim().length >= 3 &&
    description.trim().length >= 10 &&
    beliefs.every((b) => b.trim().length >= 3) &&
    !usedColours.has(colour.toLowerCase());

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Found a Political Party
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Founding cost: ${(PARTY_FOUNDING_COST / 100).toLocaleString()}. You become the founder and
          first member.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Party Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Harmony Coalition" maxLength={60} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does your party stand for?"
            rows={3}
            maxLength={500}
          />
        </div>
        <div>
          <Label>Party Colour (must be unique)</Label>
          <ColourPicker value={colour} onChange={setColour} usedColours={usedColours} />
        </div>
        <div className="space-y-2">
          <Label>Five Core Beliefs</Label>
          {beliefs.map((b, i) => (
            <Input
              key={i}
              value={b}
              onChange={(e) => {
                const next = [...beliefs] as typeof beliefs;
                next[i] = e.target.value;
                setBeliefs(next);
              }}
              placeholder={`Belief #${i + 1}`}
              maxLength={120}
            />
          ))}
        </div>
        <Button
          className="w-full"
          disabled={!canSubmit || create.isPending}
          onClick={() => {
            create.mutate(
              { name, description, colour_hex: colour, beliefs },
              { onSuccess: () => onCreated?.() }
            );
          }}
        >
          {create.isPending ? "Founding…" : "Found Party"}
        </Button>
      </CardContent>
    </Card>
  );
}
