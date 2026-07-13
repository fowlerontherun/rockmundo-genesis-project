import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Music, Sparkles } from "lucide-react";

export function ProfileInfoCard({ title, icon: Icon = Sparkles, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-5 w-5" />{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>;
}

export function BandProfileCard({ band }: { band: { id: string; name: string; genre?: string | null; role?: string | null } }) {
  return <div className="rounded-md border p-3"><Link to={`/band/${band.id}`} className="font-medium hover:underline">{band.name}</Link><div className="mt-2 flex gap-2">{band.genre && <Badge variant="secondary">{band.genre}</Badge>}{band.role && <Badge variant="outline">{band.role}</Badge>}</div></div>;
}

export function EmploymentProfileCard({ employer, jobTitle }: { employer?: { id: string; name: string } | null; jobTitle?: string | null }) {
  if (!employer && !jobTitle) return <p className="text-sm text-muted-foreground">No public employment listed.</p>;
  return <div className="rounded-md border p-3"><div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" /><span className="font-medium">{jobTitle || 'Current job'}</span></div>{employer && <Link to={`/company/${employer.id}`} className="text-sm text-muted-foreground hover:underline">{employer.name}</Link>}</div>;
}

export function OpenStatusBadges({ profile }: { profile: any }) {
  const statuses = [
    profile?.looking_for_band && 'Open to joining a band',
    profile?.looking_for_members && 'Looking for band members',
    profile?.available_for_session_work && 'Open to session work',
    profile?.available_for_gigs && 'Open to touring/gigs',
    profile?.available_for_collaboration && 'Open to collaborations',
    profile?.available_for_employment && 'Looking for employment',
    profile?.available_for_teaching && 'Available for teaching',
    profile?.available_for_social && 'Available for social activities',
  ].filter(Boolean) as string[];
  if (!statuses.length) return <Badge variant="outline">Not currently available</Badge>;
  return <div className="flex flex-wrap gap-2">{statuses.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>;
}
