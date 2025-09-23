// Temporarily simplified BandChemistry
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BandChemistry() {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Band Chemistry</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Band chemistry features are being updated. Please check back later.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}