import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const InventoryManager = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Inventory Manager</h1>
        <p className="text-muted-foreground">Manage your equipment and wardrobe</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory System Coming Soon</CardTitle>
          <CardDescription>
            Equipment and wardrobe management features are currently under development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This feature will include equipment management, wardrobe customization, 
            and inventory tracking. Check back soon for updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryManager;