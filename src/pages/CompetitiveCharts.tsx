import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const CompetitiveCharts = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Competitive Charts</h1>
        <p className="text-muted-foreground">Track your musical success against other artists</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Charts Coming Soon</CardTitle>
          <CardDescription>
            Competitive charts and rankings will be available in a future update.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This feature is currently under development. Check back soon for global rankings,
            chart positions, and competitive leaderboards.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompetitiveCharts;