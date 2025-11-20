import { AdminRoute } from "@/components/AdminRoute";
import { SkillDefinitionsManager } from "@/components/admin/SkillDefinitionsManager";

export default function SkillDefinitionsAdmin() {
  return (
    <AdminRoute>
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Skill Definitions</h1>
          <p className="text-muted-foreground">
            Manage skill definitions, slugs, and tier caps for the progression system.
          </p>
        </div>
        <SkillDefinitionsManager />
      </div>
    </AdminRoute>
  );
}
