import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MusicStudio = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Music Studio</h1>
        <p className="text-muted-foreground">Professional music production</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Studio Features Coming Soon</CardTitle>
          <CardDescription>
            Professional music production features are currently under development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This feature will include advanced recording sessions, multi-track production, 
            and professional audio engineering tools. Check back soon for updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MusicStudio;