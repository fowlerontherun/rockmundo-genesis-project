import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SocialMedia() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Social Media</h1>
      <Card>
        <CardHeader>
          <CardTitle>Community Feed</CardTitle>
          <CardDescription>Connect with other musicians and share your journey</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Social media features coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
