import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AdminRoute } from "@/components/AdminRoute";
import { AlertTriangle, CheckCircle2, Database, Settings2 } from "lucide-react";
import SkillDefinitionsManager from "@/components/admin/SkillDefinitionsManager";

const AdminDashboard = () => {
  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage core configuration and live game data</p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Live Tools Enabled
          </Badge>
        </div>

        <Alert className="bg-muted/60">
          <AlertDescription>
            Use these tools to configure skill definitions and parent relationships. Changes are applied immediately to the live database.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Data Integrity
              </CardTitle>
              <CardDescription>Track schema health and required follow-up</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>✅ Skill definitions synced</p>
              <p>✅ Parent links operational</p>
              <p>⚠️ Additional admin modules pending migration</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Change Management
              </CardTitle>
              <CardDescription>Review update best practices</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Validate tier caps before publishing updates.</p>
              <p>• Link parent skills to enforce proper unlock flow.</p>
              <p>• Refresh in-game clients after major schema edits.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Upcoming Modules
              </CardTitle>
              <CardDescription>Feature roadmap for admin suite</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Player progression tuning controls</p>
              <p>• Economy balancing dashboards</p>
              <p>• Live event configuration tools</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => window.location.href = '/admin/production-notes'}>
            <CardHeader>
              <CardTitle>Production Notes</CardTitle>
              <CardDescription>Manage setlist production elements</CardDescription>
            </CardHeader>
          </Card>
          <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => window.location.href = '/admin/song-gifts'}>
            <CardHeader>
              <CardTitle>Song Gifts</CardTitle>
              <CardDescription>Gift songs to bands</CardDescription>
            </CardHeader>
          </Card>
          <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => window.location.href = '/admin/music-videos'}>
            <CardHeader>
              <CardTitle>AI Music Videos</CardTitle>
              <CardDescription>Debug & manage video generation</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Skill Definitions</CardTitle>
            <CardDescription>Manage available skills, tier caps, and prerequisite relationships.</CardDescription>
          </CardHeader>
          <CardContent>
            <SkillDefinitionsManager />
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
};

export default AdminDashboard;