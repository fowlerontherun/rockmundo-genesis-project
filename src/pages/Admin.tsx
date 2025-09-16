import { AdminRoute } from '@/components/AdminRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  Shield, 
  Settings, 
  Database,
  Activity,
  TrendingUp,
  AlertCircle,
  Crown
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserWithRole {
  id: string;
  email: string;
  username: string;
  display_name: string;
  role: string;
  created_at: string;
  last_sign_in_at: string;
}

const Admin = () => {
  const { userRole, isAdmin } = useUserRole();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      // Load profiles with roles
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles(role)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedUsers = data.map(user => ({
        id: user.user_id,
        email: user.username + '@rockmundo.com', // Mock email
        username: user.username,
        display_name: user.display_name,
        role: (user.user_roles as any)?.[0]?.role || 'user',
        created_at: user.created_at,
        last_sign_in_at: user.updated_at
      }));

      setUsers(formattedUsers);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load users"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'moderator' | 'user') => {
    try {
      // First delete existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Then insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: newRole
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User role updated successfully"
      });

      loadUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error updating user role:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update user role"
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'moderator': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <AdminRoute requiredRole="admin">
      <div className="min-h-screen bg-gradient-stage p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bebas tracking-wider bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent flex items-center justify-center gap-2">
              <Crown className="h-8 w-8 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground font-oswald">Manage your Rockmundo application</p>
          </div>

          {/* Role Display */}
          <div className="flex justify-center">
            <Badge variant="destructive" className="text-lg px-4 py-2">
              <Shield className="h-4 w-4 mr-2" />
              Administrator
            </Badge>
          </div>

          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="system">System</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Users Management */}
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Management
                  </CardTitle>
                  <CardDescription>
                    Manage user accounts and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="mt-2 text-muted-foreground">Loading users...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {users.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div>
                                <h4 className="font-semibold">{user.display_name}</h4>
                                <p className="text-sm text-muted-foreground">@{user.username}</p>
                              </div>
                              <Badge variant={getRoleBadgeVariant(user.role)}>
                                {user.role}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Joined: {new Date(user.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          
                          {isAdmin() && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateUserRole(user.id, 'moderator')}
                                disabled={user.role === 'admin'}
                              >
                                Make Moderator
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateUserRole(user.id, 'user')}
                                disabled={user.role === 'admin'}
                              >
                                Make User
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics */}
            <TabsContent value="analytics">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{users.length}</div>
                    <p className="text-xs text-muted-foreground">
                      Registered users
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Admins</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {users.filter(u => u.role === 'admin').length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Administrator accounts
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">System Status</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">Online</div>
                    <p className="text-xs text-muted-foreground">
                      All systems operational
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* System */}
            <TabsContent value="system">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    System Information
                  </CardTitle>
                  <CardDescription>
                    System status and database information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded">
                      <h4 className="font-semibold">Database</h4>
                      <p className="text-sm text-green-600">Connected</p>
                    </div>
                    <div className="p-3 border rounded">
                      <h4 className="font-semibold">Authentication</h4>
                      <p className="text-sm text-green-600">Active</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings */}
            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Application Settings
                  </CardTitle>
                  <CardDescription>
                    Configure application-wide settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Advanced settings coming soon. Contact support for configuration changes.
                      </AlertDescription>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminRoute>
  );
};

export default Admin;