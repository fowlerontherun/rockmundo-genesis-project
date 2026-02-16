import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Shield, ShieldCheck, User } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface UserWithRole {
  user_id: string;
  role: string;
  username: string | null;
  avatar_url: string | null;
}

const roleBadge = (role: string) => {
  switch (role) {
    case "admin":
      return <Badge className="bg-destructive/15 text-destructive border-destructive/30"><ShieldCheck className="h-3 w-3 mr-1" />Admin</Badge>;
    case "moderator":
      return <Badge className="bg-warning/15 text-warning border-warning/30"><Shield className="h-3 w-3 mr-1" />Moderator</Badge>;
    default:
      return <Badge variant="outline"><User className="h-3 w-3 mr-1" />User</Badge>;
  }
};

export default function AdminUserRoles() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch user_roles joined with profiles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url");

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const merged: UserWithRole[] = (roles || []).map(r => {
        const profile = profileMap.get(r.user_id);
        return {
          user_id: r.user_id,
          role: r.role,
          username: profile?.username || null,
          avatar_url: profile?.avatar_url || null,
        };
      });

      setUsers(merged);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole as "admin" | "moderator" | "user" })
        .eq("user_id", userId);

      if (error) throw error;

      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
      toast({ title: "Role updated", description: `User role changed to ${newRole}` });
    } catch (err) {
      console.error("Error updating role:", err);
      toast({ title: "Error", description: "Failed to update role", variant: "destructive" });
    }
  };

  const filtered = users.filter(u =>
    !search || (u.username || u.user_id).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          User Role Management
        </CardTitle>
        <CardDescription>View and manage user roles across the platform</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading users...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Change Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(user => (
                  <TableRow key={user.user_id}>
                    <TableCell className="flex items-center gap-2">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium">{user.username || user.user_id.slice(0, 8)}</span>
                    </TableCell>
                    <TableCell>{roleBadge(user.role)}</TableCell>
                    <TableCell>
                      <Select value={user.role} onValueChange={val => handleRoleChange(user.user_id, val)}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="moderator">Moderator</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
