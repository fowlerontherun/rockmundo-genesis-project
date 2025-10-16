import { useEffect, useState } from "react";
import { useCreateSetlist, useUpdateSetlist, useSetlists } from "@/hooks/useSetlists";
import { ProductionNotesSelector } from "./ProductionNotesSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SetlistEditorProps {
  bandId: string;
  setlistId?: string;
  onClose: () => void;
  bandFame?: number;
}

export const SetlistEditor = ({ bandId, setlistId, onClose, bandFame = 0 }: SetlistEditorProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [setlistType, setSetlistType] = useState("custom");

  const { data: setlists } = useSetlists(bandId);
  const createMutation = useCreateSetlist();
  const updateMutation = useUpdateSetlist();

  useEffect(() => {
    if (setlistId && setlists) {
      const setlist = setlists.find((s) => s.id === setlistId);
      if (setlist) {
        setName(setlist.name);
        setDescription(setlist.description || "");
        setSetlistType(setlist.setlist_type);
      }
    }
  }, [setlistId, setlists]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (setlistId) {
      updateMutation.mutate(
        {
          setlistId,
          updates: { name, description, setlist_type: setlistType },
        },
        { onSuccess: onClose }
      );
    } else {
      createMutation.mutate(
        { bandId, name, setlistType, description },
        { onSuccess: onClose }
      );
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{setlistId ? "Edit Setlist" : "Create New Setlist"}</DialogTitle>
          <DialogDescription>
            {setlistId
              ? "Update your setlist details"
              : "Create a new setlist for your band"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="production" disabled={!setlistId}>
                Production Notes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Setlist Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Summer Tour 2025"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Setlist Type</Label>
              <Select value={setlistType} onValueChange={setSetlistType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="tour">Tour</SelectItem>
                  <SelectItem value="arena">Arena</SelectItem>
                  <SelectItem value="club">Club</SelectItem>
                  <SelectItem value="festival">Festival</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this setlist..."
                rows={3}
              />
            </div>
            </TabsContent>

            <TabsContent value="production" className="py-4">
              {setlistId && (
                <ProductionNotesSelector
                  setlistId={setlistId}
                  bandFame={bandFame}
                />
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {setlistId ? "Update" : "Create"} Setlist
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
