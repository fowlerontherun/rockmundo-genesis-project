import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdminRoute } from '@/components/AdminRoute';
import { AlertTriangle, Construction } from 'lucide-react';

const AdminDashboard = () => {
  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">System administration and configuration</p>
          </div>
          <Badge variant="outline" className="bg-warning/10">
            Under Development
          </Badge>
        </div>

        <Alert>
          <Construction className="h-4 w-4" />
          <AlertDescription>
            The admin dashboard is currently under development. Core functionality is being rebuilt to work with the current database schema.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Admin functionality is being redesigned to work with the current database structure.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">✅ User authentication</p>
              <p className="text-sm">✅ Role-based access</p>
              <p className="text-sm">⏳ Database management</p>
              <p className="text-sm">⏳ System metrics</p>
              <p className="text-sm">⏳ Configuration tools</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Admin tools will be rebuilt once the core database schema is finalized and all required tables are properly configured.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default AdminDashboard;