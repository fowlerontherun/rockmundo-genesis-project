import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CommunityFeed() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Community Feed</h1>
      <Card>
        <CardHeader>
          <CardTitle>Community Posts</CardTitle>
          <CardDescription>See what other musicians are up to</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Community feed coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
