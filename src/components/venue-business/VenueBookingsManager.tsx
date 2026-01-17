import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Clock, Music, X } from "lucide-react";
import { useVenueBookings, useCreateVenueBooking, useUpdateBookingStatus } from "@/hooks/useVenueBusiness";
import { BOOKING_TYPES } from "@/types/venue-business";
import { format } from "date-fns";

interface VenueBookingsManagerProps {
  venueId: string;
}

export function VenueBookingsManager({ venueId }: VenueBookingsManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bookingType, setBookingType] = useState<string>("gig");
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("20:00");
  const [endTime, setEndTime] = useState("23:00");
  const [rentalFee, setRentalFee] = useState("");
  const [notes, setNotes] = useState("");
  
  const { data: bookings, isLoading } = useVenueBookings(venueId);
  const createBooking = useCreateVenueBooking();
  const updateStatus = useUpdateBookingStatus();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createBooking.mutateAsync({
      venue_id: venueId,
      booking_type: bookingType,
      booking_date: bookingDate,
      start_time: startTime,
      end_time: endTime,
      rental_fee: rentalFee ? parseFloat(rentalFee) : undefined,
      notes: notes || undefined,
    });
    
    setDialogOpen(false);
    setBookingType("gig");
    setBookingDate("");
    setStartTime("20:00");
    setEndTime("23:00");
    setRentalFee("");
    setNotes("");
  };
  
  const handleStatusChange = (bookingId: string, status: string) => {
    updateStatus.mutate({ bookingId, status, venueId });
  };
  
  const upcomingBookings = bookings?.filter(b => b.status !== 'completed' && b.status !== 'cancelled') || [];
  const pastBookings = bookings?.filter(b => b.status === 'completed' || b.status === 'cancelled') || [];
  
  if (isLoading) {
    return <div className="text-center py-4">Loading bookings...</div>;
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Venue Bookings
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Booking
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Booking</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Booking Type</Label>
                <Select value={bookingType} onValueChange={setBookingType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Rental Fee ($)</Label>
                <Input
                  type="number"
                  min="0"
                  value={rentalFee}
                  onChange={(e) => setRentalFee(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={createBooking.isPending}>
                {createBooking.isPending ? "Creating..." : "Create Booking"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {bookings?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No bookings yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingBookings.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Upcoming</h4>
                <div className="space-y-2">
                  {upcomingBookings.slice(0, 5).map((booking) => {
                    const typeInfo = BOOKING_TYPES.find(t => t.value === booking.booking_type);
                    return (
                      <div 
                        key={booking.id} 
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${typeInfo?.color || 'bg-gray-500'}`} />
                          <div>
                            <p className="font-medium">
                              {typeInfo?.label || booking.booking_type}
                              {booking.band?.name && ` - ${booking.band.name}`}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(booking.booking_date), 'MMM d, yyyy')}</span>
                              {booking.start_time && (
                                <>
                                  <Clock className="h-3 w-3 ml-2" />
                                  <span>{booking.start_time} - {booking.end_time}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {booking.rental_fee && (
                            <span className="text-sm font-medium text-green-500">
                              ${booking.rental_fee}
                            </span>
                          )}
                          <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                            {booking.status}
                          </Badge>
                          <Select 
                            value={booking.status} 
                            onValueChange={(value) => handleStatusChange(booking.id, value)}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {pastBookings.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Past Bookings</h4>
                <div className="space-y-2 opacity-75">
                  {pastBookings.slice(0, 3).map((booking) => {
                    const typeInfo = BOOKING_TYPES.find(t => t.value === booking.booking_type);
                    return (
                      <div 
                        key={booking.id} 
                        className="flex items-center justify-between p-2 rounded-lg border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full opacity-50 ${typeInfo?.color || 'bg-gray-500'}`} />
                          <span className="text-sm">{typeInfo?.label} - {format(new Date(booking.booking_date), 'MMM d')}</span>
                        </div>
                        <Badge variant={booking.status === 'completed' ? 'outline' : 'destructive'}>
                          {booking.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
