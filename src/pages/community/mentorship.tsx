import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CommunityMentorship() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Mentorship Program</h1>
      <Card>
        <CardHeader>
          <CardTitle>Find a Mentor</CardTitle>
          <CardDescription>Connect with experienced musicians who can guide your journey</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Mentorship program coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
