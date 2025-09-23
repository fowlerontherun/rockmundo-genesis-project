import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGameData } from '@/hooks/useGameDataSimplified';

const Dashboard = () => {
  const { profile, loading, error } = useGameData();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-32 w-32 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-lg font-oswald">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to Rockmundo</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Create your character to get started with your musical journey!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.level}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Experience</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.experience}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${profile.cash?.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fame</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.fame}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Character Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Name:</strong> {profile.display_name}</p>
            <p><strong>Username:</strong> {profile.username}</p>
            {profile.bio && <p><strong>Bio:</strong> {profile.bio}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;