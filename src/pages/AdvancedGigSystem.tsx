// Temporarily simplified AdvancedGigSystem
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdvancedGigSystem() {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Advanced Gig System</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Advanced gig features are being updated. Please check back later.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}