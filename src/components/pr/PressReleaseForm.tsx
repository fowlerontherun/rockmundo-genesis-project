import { useState } from "react";
import { Megaphone, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PressReleaseFormValues } from "./types";

interface PressReleaseFormProps {
  onSubmit: (values: PressReleaseFormValues) => void;
  isSubmitting?: boolean;
}

const defaultValues: PressReleaseFormValues = {
  title: "",
  channel: "Official Site",
  date: new Date().toISOString().slice(0, 10),
  status: "draft",
  notes: "",
};

export function PressReleaseForm({ onSubmit, isSubmitting }: PressReleaseFormProps) {
  const [values, setValues] = useState<PressReleaseFormValues>(defaultValues);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(values);
    setValues(defaultValues);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          <div>
            <CardTitle>New Press Release</CardTitle>
            <CardDescription>Keep your audience updated with timely announcements.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Announce a milestone, tour, or collaboration"
              value={values.title}
              onChange={(event) => setValues({ ...values, title: event.target.value })}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="channel">Primary Channel</Label>
              <Input
                id="channel"
                placeholder="Official Site, Newsletter, Partner Blog"
                value={values.channel}
                onChange={(event) => setValues({ ...values, channel: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Publish Date</Label>
              <Input
                id="date"
                type="date"
                value={values.date}
                onChange={(event) => setValues({ ...values, date: event.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={values.status}
              onValueChange={(value) => setValues({ ...values, status: value as PressReleaseFormValues["status"] })}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Key Highlights</Label>
            <Textarea
              id="notes"
              placeholder="Add talking points, quotes, or distribution notes"
              value={values.notes}
              onChange={(event) => setValues({ ...values, notes: event.target.value })}
              rows={4}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            <Sparkles className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save draft"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
