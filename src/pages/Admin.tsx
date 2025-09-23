import {
  Building2,
  Gift,
  GraduationCap,
  NotebookPen,
  PlaySquare,
  Rocket,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AdminRoute } from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const adminSections = [
  {
    title: "Experience Rewards",
    description: "Grant instant XP bonuses to individual players or the entire community.",
    href: "/admin/experience-rewards",
    action: "Manage XP rewards",
    Icon: Gift,
  },
  {
    title: "Universities",
    description: "Curate the university roster that shapes the world's education economy.",
    href: "/admin/universities",
    action: "Manage universities",
    Icon: GraduationCap,
  },
  {
    title: "Cities",
    description: "Manage destination data, cultural hooks, and gameplay modifiers for each city.",
    href: "/admin/cities",
    action: "Manage cities",
    Icon: Building2,
  },
  {
    title: "Skill Books",
    description: "Configure purchasable books that unlock skills and deliver XP to players.",
    href: "/admin/skill-books",
    action: "Manage skill books",
    Icon: NotebookPen,
  },
  {
    title: "Underworld Store",
    description: "Manage the artifacts offered through the Underworld Nexus storefront.",
    href: "/admin/underworld-store",
    action: "Manage store items",
    Icon: Store,
  },
  {
    title: "YouTube Playlists",
    description: "Curate lessons and supporting playlists for the Education page.",
    href: "/admin/youtube-videos",
    action: "Manage YouTube content",
    Icon: PlaySquare,
  },
  {
    title: "Band Learning",
    description: "Curate collaborative sessions that power the band's education track.",
    href: "/admin/band-learning",
    action: "Manage band sessions",
    Icon: Sparkles,
  },
  {
    title: "Mentors",
    description: "Control the mentor roster powering education XP and progression boosts.",
    href: "/admin/mentors",
    action: "Manage mentors",
    Icon: Users,
  },
  {
    title: "Player Boosts",
    description: "Calibrate temporary boosts and bonuses that accelerate individual player growth.",
    href: "/admin/player-boosts",
    action: "Configure player boosts",
    Icon: Rocket,
  },
] as const;

export default function Admin() {
  return (
    <AdminRoute>
      <div className="container mx-auto max-w-5xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground">
            Configure world data and manage gameplay balancing parameters across dedicated admin tools.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {adminSections.map(({ title, description, href, action, Icon }) => (
            <Card key={title} className="flex flex-col justify-between">
              <CardHeader className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="rounded-full bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle className="text-xl">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link to={href}>{action}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminRoute>
  );
}
