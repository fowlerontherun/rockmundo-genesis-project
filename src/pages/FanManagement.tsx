import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const FanManagement = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Fan Management</h1>
        <p className="text-muted-foreground">Build and engage your fanbase</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fan Features Coming Soon</CardTitle>
          <CardDescription>
            Fan management and engagement features are currently under development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This feature will include fan analytics, engagement campaigns, 
            and social media management. Check back soon for updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FanManagement;