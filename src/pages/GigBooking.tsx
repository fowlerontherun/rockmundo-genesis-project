import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const GigBooking = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gig Booking</h1>
        <p className="text-muted-foreground">Book performances and build your career</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gig System Coming Soon</CardTitle>
          <CardDescription>
            Performance booking and venue management features are currently under development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This feature will include venue booking, performance scheduling, 
            and earnings tracking. Check back soon for updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default GigBooking;