import { AdminRoute } from "@/components/AdminRoute";
import { AdminReleaseTools } from "@/components/admin/AdminReleaseTools";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Clock, AlertTriangle, CheckCircle, Package } from "lucide-react";

function ReleasesAdminContent() {
  // Fetch releases by status
  const { data: releases = [] } = useQuery({
    queryKey: ['admin-releases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('releases')
        .select('*, bands(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    }
  });

  const stuckReleases = releases.filter(r => 
    r.release_status === 'manufacturing' && 
    r.manufacturing_complete_at && 
    new Date(r.manufacturing_complete_at) < new Date()
  );

  const pendingReleases = releases.filter(r => 
    r.release_status === 'manufacturing' && 
    r.manufacturing_complete_at && 
    new Date(r.manufacturing_complete_at) >= new Date()
  );

  const completedReleases = releases.filter(r => r.release_status === 'released');
  const draftReleases = releases.filter(r => r.release_status === 'draft');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Releases Admin</h1>
          <p className="text-muted-foreground">Manage release manufacturing and distribution</p>
        </div>
      </div>

      {/* Admin Tools */}
      <AdminReleaseTools />

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Stuck
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stuckReleases.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Manufacturing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{pendingReleases.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Released
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{completedReleases.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftReleases.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Stuck Releases Detail */}
      {stuckReleases.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Stuck Releases (Requires Attention)
            </CardTitle>
            <CardDescription>
              These releases have passed their manufacturing date but haven't been completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stuckReleases.map(release => (
                <div key={release.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div>
                    <p className="font-medium">{release.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {release.bands?.name || 'Unknown Artist'} • {release.release_type}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive">STUCK</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {release.manufacturing_complete_at ? format(new Date(release.manufacturing_complete_at), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Releases */}
      <Card>
        <CardHeader>
          <CardTitle>All Releases</CardTitle>
          <CardDescription>Recent release activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {releases.slice(0, 20).map(release => (
              <div key={release.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">{release.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {release.bands?.name || 'Unknown'} • {release.release_type} • Created {format(new Date(release.created_at), 'MMM dd, yyyy')}
                  </p>
                </div>
                <Badge 
                  variant={
                    release.release_status === 'released' ? 'default' :
                    release.release_status === 'manufacturing' ? 'secondary' :
                    'outline'
                  }
                >
                  {release.release_status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReleasesAdminPage() {
  return (
    <AdminRoute>
      <ReleasesAdminContent />
    </AdminRoute>
  );
}
