import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LifestyleHomes() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Property Management</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your Properties</CardTitle>
          <CardDescription>Manage your real estate investments</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Property management coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
