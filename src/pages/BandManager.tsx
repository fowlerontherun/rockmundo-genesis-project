// Temporarily simplified BandManager
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BandManager() {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Band Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Band management features are being updated. Please check back later.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}