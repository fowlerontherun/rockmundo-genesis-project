import {
  AudioLines,
  Building2,
  Disc3,
  Gift,
  GraduationCap,
  NotebookPen,
  PlaySquare,
  Sparkles,
  Users,
  BookOpen,
  Briefcase,
  Music2,
  Plane,
  Calendar,
  TrendingUp,
  Shield,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AdminRoute } from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const adminSections = [
  {
    title: "Game Calendar",
    description: "Configure in-game time progression, seasons, and seasonal modifiers for genres.",
    href: "/admin/game-calendar",
    action: "Manage calendar",
    Icon: Calendar,
  },
  {
    title: "Cities",
    description: "Manage destination data, cultural hooks, and gameplay modifiers for each city.",
    href: "/admin/cities",
    action: "Manage cities",
    Icon: Building2,
  },
  {
    title: "Universities",
    description: "Curate the university roster that shapes the world's education economy.",
    href: "/admin/universities",
    action: "Manage universities",
    Icon: GraduationCap,
  },
  {
    title: "University Courses",
    description: "Configure courses, prerequisites, pricing, and XP rewards for each university.",
    href: "/admin/courses",
    action: "Manage courses",
    Icon: BookOpen,
  },
  {
    title: "Night Clubs",
    description: "Curate nightlife venues, DJ slot requirements, and social actions by city.",
    href: "/admin/night-clubs",
    action: "Manage night clubs",
    Icon: Disc3,
  },
  {
    title: "Skill Books",
    description: "Configure purchasable books that unlock skills and deliver XP to players.",
    href: "/admin/skill-books",
    action: "Manage skill books",
    Icon: NotebookPen,
  },
  {
    title: "Mentors",
    description: "Control the mentor roster powering education XP and progression boosts.",
    href: "/admin/mentors",
    action: "Manage mentors",
    Icon: Users,
  },
  {
    title: "Jobs",
    description: "Create and manage employment opportunities with schedules, salaries, and impacts.",
    href: "/admin/jobs",
    action: "Manage jobs",
    Icon: Briefcase,
  },
  {
    title: "Venues",
    description: "Manage performance venues, capacities, prestige levels, and booking requirements.",
    href: "/admin/venues",
    action: "Manage venues",
    Icon: Music2,
  },
  {
    title: "Rehearsal Rooms",
    description: "Manage rehearsal spaces where bands practice to improve chemistry and gig readiness.",
    href: "/admin/rehearsal-rooms",
    action: "Manage rehearsal rooms",
    Icon: Music2,
  },
  {
    title: "Travel Routes",
    description: "Configure transportation routes between cities with costs, duration, and comfort ratings.",
    href: "/admin/travel",
    action: "Manage travel routes",
    Icon: Plane,
  },
  {
    title: "Song Gifts",
    description: "Create fully-featured songs with all attributes and gift them to bands.",
    href: "/admin/song-gifts",
    action: "Gift songs",
    Icon: Gift,
    },
    {
      title: "Streaming Platforms",
      description: "Manage streaming platforms, configure payout rates, and set quality requirements.",
      href: "/admin/streaming-platforms",
      action: "Manage platforms",
      Icon: Music2,
    },
    {
      title: "Song Marketplace",
      description: "Moderate listings, manage disputes, configure fees, and view transaction analytics.",
      href: "/admin/marketplace",
      action: "Manage marketplace",
      Icon: TrendingUp,
    },
  {
    title: "Recording Studios",
    description: "Manage city recording studios with quality ratings, hourly rates, specialties, and equipment.",
    href: "/admin/city-studios",
    action: "Manage studios",
    Icon: Music2,
  },
  {
    title: "Recording Producers",
    description: "Manage producers available for recording sessions with skills, costs, and specializations.",
    href: "/admin/producers",
    action: "Manage producers",
    Icon: AudioLines,
  },
  {
    title: "Twaater Moderation",
    description: "Review reported content, manage filter words, and moderate user-generated posts.",
    href: "/admin/twaater-moderation",
    action: "Moderate content",
    Icon: Shield,
  },
  {
    title: "Cron Monitor",
    description: "Monitor automated background tasks, view execution logs, and manually trigger functions.",
    href: "/admin/cron-monitor",
    action: "View monitor",
    Icon: Clock,
  },
  {
    title: "Release Configuration",
    description: "Configure costs and pricing for music releases across all formats (digital, CD, vinyl).",
    href: "/admin/release-config",
    action: "Manage config",
    Icon: Disc3,
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
