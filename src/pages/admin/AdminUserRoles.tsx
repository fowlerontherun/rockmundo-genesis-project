import { AdminRoute } from "@/components/AdminRoute";
import AdminUserRoles from "@/components/admin/AdminUserRoles";

const AdminUserRolesPage = () => (
  <AdminRoute>
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-foreground">User Role Management</h1>
      <AdminUserRoles />
    </div>
  </AdminRoute>
);

export default AdminUserRolesPage;
