import { Outlet, NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Sparkles, GraduationCap, BookOpen } from "lucide-react";

import { AdminRoute } from "@/components/AdminRoute";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const adminNavItems = [
  {
    to: "dashboard",
    label: "Dashboard",
    description: "Skill tools overview",
    icon: LayoutDashboard,
  },
  {
    to: "experience-rewards",
    label: "Experience Rewards",
    description: "Grant special XP bonuses",
    icon: Sparkles,
  },
  {
    to: "universities",
    label: "Universities",
    description: "Manage education hubs",
    icon: GraduationCap,
  },
  {
    to: "skill-books",
    label: "Skill Books",
    description: "Control unlockable content",
    icon: BookOpen,
  },
];

const AdminLayout = () => {
  const location = useLocation();

  return (
    <AdminRoute>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl space-y-6 p-6 pb-12">
          <header className="space-y-2">
            <p className="text-sm uppercase tracking-wide text-primary/80">Rockmundo Control Center</p>
            <h1 className="text-3xl font-semibold tracking-tight">Admin Suite</h1>
            <p className="text-muted-foreground">
              Configure progression systems, manage education hubs, and align unlockable content with the live game world.
            </p>
          </header>

          <nav className="flex flex-wrap gap-2 rounded-lg border bg-muted/40 p-2">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "dashboard"}
                  className={({ isActive }) =>
                    cn(
                      buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "sm" }),
                      "flex-1 min-w-[220px] justify-start gap-3 text-left",
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </div>
                </NavLink>
              );
            })}
          </nav>

          <section key={location.pathname} className="space-y-6">
            <Outlet />
          </section>
        </div>
      </div>
    </AdminRoute>
  );
};

export default AdminLayout;
