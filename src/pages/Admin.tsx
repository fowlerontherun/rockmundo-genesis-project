// Temporarily disabled Admin page until advanced features are implemented
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Admin() {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Admin functionality is temporarily disabled while the system is being updated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}