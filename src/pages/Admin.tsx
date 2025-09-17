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
  AlertCircle,
  Crown
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRole {
  id: string;
  email: string | null;
  username: string;
  display_name: string;
  role: AppRole;
  created_at: string | null;
  last_sign_in_at: string | null;
}

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];

type ProfileWithRole = Pick<
  ProfileRow,
  'user_id' | 'username' | 'display_name' | 'created_at' | 'updated_at'
> & {
  user_roles: Array<Pick<UserRoleRow, 'role'> | null> | null;
};

const DEFAULT_ROLE: AppRole = 'user';

const resolveRole = (roles: ProfileWithRole['user_roles']): AppRole => {
  if (Array.isArray(roles)) {
    for (const entry of roles) {
      if (entry && entry.role) {
        return entry.role;
      }
    }
  }

  return DEFAULT_ROLE;
};

const fetchAuthEmailMap = async (userIds: string[]): Promise<Map<string, string | null>> => {
  const emailMap = new Map<string, string | null>();

  if (userIds.length === 0) {
    return emailMap;
  }

  const uniqueIds = Array.from(new Set(userIds));
  const perPage = Math.max(1, Math.min(uniqueIds.length, 1000));

  try {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage,
    });

    if (error) {
      throw error;
    }

    const idSet = new Set(uniqueIds);

    for (const authUser of data?.users ?? []) {
      if (idSet.has(authUser.id)) {
        emailMap.set(authUser.id, authUser.email ?? null);
      }
    }
  } catch (error) {
    console.error('Error fetching user emails:', error);
  }

  return emailMap;
};

const Admin = () => {
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          username,
          display_name,
          created_at,
          updated_at,
          user_roles(role)
        `)
        .order('created_at', { ascending: false })
        .returns<ProfileWithRole[]>();

      if (error) {
        throw error;
      }

      const profiles = data ?? [];
      const emailMap = await fetchAuthEmailMap(profiles.map((profile) => profile.user_id));

      const formattedUsers: UserWithRole[] = profiles.map((profile) => {
        const role = resolveRole(profile.user_roles);

        return {
          id: profile.user_id,
          email: emailMap.get(profile.user_id) ?? null,
          username: profile.username,
          display_name: profile.display_name ?? profile.username,
          role,
          created_at: profile.created_at,
          last_sign_in_at: profile.updated_at ?? profile.created_at ?? null,
        };
      });

      setUsers(formattedUsers);
    } catch (error: unknown) {
      console.error('Error loading users:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load users"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const updateUserRole = async (userId: string, newRole: AppRole) => {
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
        description: `User role updated to ${newRole} successfully`
      });

      await loadUsers(); // Refresh the list
    } catch (error: unknown) {
      console.error('Error updating user role:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user role"
      });
    }
  };

  const makeAdmin = async (userId: string) => {
    if (confirm("Are you sure you want to make this user an admin? This will give them full administrative privileges.")) {
      await updateUserRole(userId, 'admin');
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
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
                                <p className="text-sm text-muted-foreground">
                                  Email: {user.email ?? 'N/A'}
                                </p>
                              </div>
                              <Badge variant={getRoleBadgeVariant(user.role)}>
                                {user.role}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Joined: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                            </p>
                          </div>
                          
                          {isAdmin() && (
                            <div className="flex gap-2 flex-wrap">
                              {user.role !== 'admin' && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => makeAdmin(user.id)}
                                  className="gap-1"
                                >
                                  <Crown className="h-3 w-3" />
                                  Make Admin
                                </Button>
                              )}
                              {user.role !== 'moderator' && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => updateUserRole(user.id, 'moderator')}
                                  disabled={user.role === 'admin'}
                                >
                                  Make Moderator
                                </Button>
                              )}
                              {user.role !== 'user' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateUserRole(user.id, 'user')}
                                  disabled={user.role === 'admin'}
                                >
                                  Make User
                                </Button>
                              )}
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