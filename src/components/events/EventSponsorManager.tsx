import { useMemo, useState } from "react";
import { Building2, Handshake, LineChart, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { SponsorPackage } from "./types";

interface EventSponsorManagerProps {
  sponsors: SponsorPackage[];
  onSponsorsChange: (sponsors: SponsorPackage[]) => void;
}

const sponsorshipLevels: SponsorPackage["level"][] = ["title", "presenting", "supporting", "local"];

export const EventSponsorManager = ({ sponsors, onSponsorsChange }: EventSponsorManagerProps) => {
  const [form, setForm] = useState<Omit<SponsorPackage, "id">>({
    name: "",
    level: "supporting",
    contribution: 0,
    benefits: "",
    activationFocus: "",
    roiGoal: "",
  });

  const totalContribution = useMemo(() => {
    return sponsors.reduce((total, sponsor) => total + sponsor.contribution, 0);
  }, [sponsors]);

  const averageROICommitment = useMemo(() => {
    if (sponsors.length === 0) {
      return "0 activations scoped";
    }

    const activations = sponsors.filter((sponsor) => sponsor.activationFocus).length;
    return `${activations} active experiential commitments`;
  }, [sponsors]);

  const resetForm = () => {
    setForm({
      name: "",
      level: "supporting",
      contribution: 0,
      benefits: "",
      activationFocus: "",
      roiGoal: "",
    });
  };

  const handleAddSponsor = () => {
    if (!form.name.trim()) {
      return;
    }

    const newSponsor: SponsorPackage = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ...form,
    };

    onSponsorsChange([...sponsors, newSponsor]);
    resetForm();
  };

  const handleRemoveSponsor = (id: string) => {
    onSponsorsChange(sponsors.filter((sponsor) => sponsor.id !== id));
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Sponsorship Architecture</CardTitle>
            <CardDescription>Model partner contributions, activations, and experience overlays.</CardDescription>
          </div>
          <Badge variant="outline" className="text-sm capitalize">
            <Handshake className="mr-1 h-4 w-4" /> {sponsors.length} partners engaged
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Cash commitments</p>
            <p className="text-lg font-semibold">${totalContribution.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Activation focus</p>
            <p className="text-lg font-semibold">{averageROICommitment}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase text-muted-foreground">Title availability</p>
            <p className="text-lg font-semibold">
              {sponsors.some((sponsor) => sponsor.level === "title") ? "Locked" : "Open"}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4 rounded-lg border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sponsor-name">Sponsor name</Label>
                <Input
                  id="sponsor-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Brand or strategic partner"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sponsor-level">Tier</Label>
                <Select
                  value={form.level}
                  onValueChange={(value: SponsorPackage["level"]) => setForm((prev) => ({ ...prev, level: value }))}
                >
                  <SelectTrigger id="sponsor-level">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {sponsorshipLevels.map((level) => (
                      <SelectItem key={level} value={level} className="capitalize">
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contribution">Contribution (USD)</Label>
              <Input
                id="contribution"
                type="number"
                min={0}
                value={form.contribution}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contribution: Number.parseFloat(event.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="benefits">Benefits & asset delivery</Label>
              <Textarea
                id="benefits"
                value={form.benefits}
                onChange={(event) => setForm((prev) => ({ ...prev, benefits: event.target.value }))}
                placeholder="Hospitality, stage naming, digital content rights, etc."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activation-focus">Activation focus</Label>
              <Input
                id="activation-focus"
                value={form.activationFocus}
                onChange={(event) => setForm((prev) => ({ ...prev, activationFocus: event.target.value }))}
                placeholder="Immersive tech, sustainability, premium hospitality"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roi-goal">ROI goal</Label>
              <Input
                id="roi-goal"
                value={form.roiGoal}
                onChange={(event) => setForm((prev) => ({ ...prev, roiGoal: event.target.value }))}
                placeholder="Brand lift, qualified leads, content capture"
              />
            </div>
            <Button onClick={handleAddSponsor} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add sponsor commitment
            </Button>
          </div>
          <div className="space-y-3">
            {sponsors.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <Building2 className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-semibold">No sponsors scoped</p>
                <p className="text-sm text-muted-foreground">
                  Build a portfolio that balances cash, media value, and in-kind experiences.
                </p>
              </div>
            ) : (
              sponsors.map((sponsor) => (
                <div key={sponsor.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {sponsor.level}
                        </Badge>
                        <p className="font-semibold">{sponsor.name}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Contributing ${sponsor.contribution.toLocaleString()} · Focus: {sponsor.activationFocus || "TBD"}
                      </p>
                      <p className="text-sm text-muted-foreground">ROI goal: {sponsor.roiGoal || "Pending alignment"}</p>
                      {sponsor.benefits && (
                        <p className="text-sm text-muted-foreground">Benefits: {sponsor.benefits}</p>
                      )}
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleRemoveSponsor(sponsor.id)}>
                      <Trash2 className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        {sponsors.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase text-muted-foreground">Strategic mix</p>
              <p className="text-sm text-muted-foreground">
                Keep at least one title or presenting partner and 2-3 supporting partners for storytelling depth.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase text-muted-foreground">Projected partner ROI</p>
              <p className="text-lg font-semibold flex items-center gap-1">
                <LineChart className="h-4 w-4" />
                {Math.round((totalContribution / Math.max(sponsors.length, 1)) * 0.12).toLocaleString()} media value units
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase text-muted-foreground">Experience readiness</p>
              <p className="text-sm text-muted-foreground">
                Align activation briefs with programming for seamless guest journeys.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
