import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AudioGenerationDashboard() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Audio Generation Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>AI Audio Generation</CardTitle>
          <CardDescription>Manage AI-generated audio content</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Audio generation dashboard coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
