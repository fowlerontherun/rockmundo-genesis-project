import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const EquipmentStore = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Equipment Store</h1>
        <p className="text-muted-foreground">Gear up for your musical journey</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Store Coming Soon</CardTitle>
          <CardDescription>
            Equipment purchasing and management features are currently under development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This feature will include instrument purchases, equipment upgrades, 
            and gear management. Check back soon for updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EquipmentStore;