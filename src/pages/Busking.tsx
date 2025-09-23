// Temporarily simplified Busking page
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Busking() {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Busking</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Busking features are being updated. Please check back later.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}