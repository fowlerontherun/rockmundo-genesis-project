import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, MapPin, Clock, Music, Users, DollarSign, Loader2 } from "lucide-react";
import { REHEARSAL_SLOTS, FacilitySlot, getSlotTimeRange } from "@/utils/facilitySlots";
import { useJamSessionBooking } from "@/hooks/useJamSessionBooking";
import { MUSIC_GENRES } from "@/data/genres";
import { useRehearsalRoomAvailability } from "@/hooks/useRehearsalRoomAvailability";

interface JamSessionBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (sessionId: string) => void;
}

export const JamSessionBookingDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: JamSessionBookingDialogProps) => {
  const { profile, isBooking, bookJamSession } = useJamSessionBooking();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [tempo, setTempo] = useState(120);
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [skillRequirement, setSkillRequirement] = useState(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [accessCode, setAccessCode] = useState("");

  // Booking state
  const [selectedCityId, setSelectedCityId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [durationHours, setDurationHours] = useState(2);

  // Fetch cities
  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data } = await supabase.from("cities").select("id, name, country").order("name");
      return data || [];
    },
  });

  // Fetch rehearsal rooms (filtered by city)
  interface RoomWithCity {
    id: string;
    name: string;
    hourly_rate: number;
    quality_rating: number;
    equipment_quality: number;
    capacity: number;
    city_id: string | null;
    city: { id: string; name: string } | null;
  }

  const { data: rooms = [] } = useQuery<RoomWithCity[]>({
    queryKey: ["rehearsal-rooms", selectedCityId],
    queryFn: async (): Promise<RoomWithCity[]> => {
      const client = supabase as any;
      let query = client
        .from("rehearsal_rooms")
        .select("id, name, hourly_rate, quality_rating, equipment_quality, capacity, city_id, city:cities(id, name)");
      
      if (selectedCityId && selectedCityId !== "all") {
        query = query.eq("city_id", selectedCityId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return (data || []) as RoomWithCity[];
    },
    enabled: open,
  });

  // Check slot availability for the selected room and date
  const { data: slotAvailability, isLoading: loadingSlots } = useRehearsalRoomAvailability(
    selectedRoomId,
    selectedDate,
    undefined, // No band ID for jam sessions
    !!selectedRoomId
  );

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const totalCost = selectedRoom ? selectedRoom.hourly_rate * durationHours : 0;
  const estimatedCostPerPerson = Math.ceil(totalCost / maxParticipants);
  const canAfford = (profile?.cash || 0) >= totalCost;

  // Check if consecutive slots are available for the duration
  const slotsNeeded = Math.ceil(durationHours / 2);
  
  const canBookSlot = (slotId: string): boolean => {
    if (!slotAvailability) return false;
    
    const slotIndex = REHEARSAL_SLOTS.findIndex(s => s.id === slotId);
    if (slotIndex === -1) return false;

    for (let i = 0; i < slotsNeeded; i++) {
      const checkSlot = REHEARSAL_SLOTS[slotIndex + i];
      if (!checkSlot) return false;
      
      const availability = slotAvailability.find(a => a.slot.id === checkSlot.id);
      if (!availability?.isAvailable) return false;
    }
    return true;
  };

  const canBook = name.trim() && 
    genre && 
    selectedRoomId && 
    selectedSlotId && 
    canBookSlot(selectedSlotId) && 
    canAfford;

  const handleBook = async () => {
    if (!canBook || !selectedDate) return;

    try {
      const sessionId = await bookJamSession({
        name,
        description,
        genre,
        tempo,
        maxParticipants,
        skillRequirement,
        isPrivate,
        accessCode,
        rehearsalRoomId: selectedRoomId,
        cityId: selectedCityId || selectedRoom?.city?.id || "",
        selectedDate,
        slotId: selectedSlotId,
        durationHours,
        totalCost,
      });

      // Reset form
      setName("");
      setDescription("");
      setGenre("");
      setTempo(120);
      setMaxParticipants(4);
      setSkillRequirement(0);
      setIsPrivate(false);
      setAccessCode("");
      setSelectedRoomId("");
      setSelectedSlotId("");
      
      onOpenChange(false);
      onSuccess?.(sessionId);
    } catch (error: any) {
      console.error("Booking failed:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Book a Jam Session
          </DialogTitle>
          <DialogDescription>
            Reserve a rehearsal room and invite musicians to collaborate
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Session Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">Session Details</h3>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Session Name *</Label>
                  <Input
                    placeholder="Late Night Groove"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Genre *</Label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {MUSIC_GENRES.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Share your vision for this jam..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tempo (BPM)</Label>
                  <Input
                    type="number"
                    min={40}
                    max={240}
                    value={tempo}
                    onChange={(e) => setTempo(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Participants</Label>
                  <Input
                    type="number"
                    min={2}
                    max={8}
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Skill Requirement</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={skillRequirement}
                    onChange={(e) => setSkillRequirement(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label>Private Session</Label>
                  <p className="text-xs text-muted-foreground">Require access code to join</p>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>

              {isPrivate && (
                <div className="space-y-2">
                  <Label>Access Code</Label>
                  <Input
                    placeholder="e.g. GROOVE2025"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Venue Booking */}
            <div className="space-y-4">
              <h3 className="font-semibold">Venue & Time</h3>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Filter by City
                </Label>
                <Select value={selectedCityId} onValueChange={(v) => { setSelectedCityId(v); setSelectedRoomId(""); setSelectedSlotId(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a city..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    {cities.map((city) => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}, {city.country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Rehearsal Room</Label>
                {rooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No rehearsal rooms available.
                  </p>
                ) : (
                  <RadioGroup value={selectedRoomId} onValueChange={(v) => { setSelectedRoomId(v); setSelectedSlotId(""); }}>
                    <div className="grid gap-2">
                      {rooms.slice(0, 6).map((room) => (
                        <div
                          key={room.id}
                          className={cn(
                            'flex items-start space-x-3 rounded-lg border p-3 transition-colors cursor-pointer',
                            selectedRoomId === room.id && 'border-primary bg-primary/5'
                          )}
                          onClick={() => { setSelectedRoomId(room.id); setSelectedSlotId(""); }}
                        >
                          <RadioGroupItem value={room.id} />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="font-semibold cursor-pointer">{room.name}</Label>
                              <Badge variant="outline">${room.hourly_rate}/hr</Badge>
                            </div>
                            {room.city && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {room.city.name}
                              </p>
                            )}
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              <span>Quality: {room.quality_rating}/100</span>
                              <span>Capacity: {room.capacity}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                )}
              </div>

              {selectedRoomId && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        Date
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            {format(selectedDate, "PPP")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && setSelectedDate(date)}
                            disabled={(date) => date < new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Duration
                      </Label>
                      <Select value={durationHours.toString()} onValueChange={(v) => { setDurationHours(Number(v)); setSelectedSlotId(""); }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 hours</SelectItem>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="6">6 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Available Time Slots</Label>
                    {loadingSlots ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {REHEARSAL_SLOTS.map((slot) => {
                          const available = canBookSlot(slot.id);
                          const isSelected = selectedSlotId === slot.id;
                          
                          return (
                            <Button
                              key={slot.id}
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              disabled={!available}
                              onClick={() => setSelectedSlotId(slot.id)}
                              className={cn(
                                !available && "opacity-50 cursor-not-allowed",
                                isSelected && "ring-2 ring-primary"
                              )}
                            >
                              {slot.name}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Cost Summary */}
            {selectedRoom && selectedSlotId && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Cost Summary
                </h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Room Rate</span>
                    <span>${selectedRoom.hourly_rate}/hr × {durationHours}hrs</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total Cost</span>
                    <span>${totalCost}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Est. Per Person ({maxParticipants} max)</span>
                    <span>~${estimatedCostPerPerson} each</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your Balance</span>
                    <span className={cn(!canAfford && "text-destructive")}>
                      ${profile?.cash || 0}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  You pay the full amount upfront. Cost is split as musicians join.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleBook} disabled={!canBook || isBooking}>
            {isBooking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Booking...
              </>
            ) : (
              <>
                <Music className="mr-2 h-4 w-4" />
                Book Session (${totalCost})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
