import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Check, X, ClipboardList, User, ExternalLink } from 'lucide-react';
import { respondBandApplication, type BandApplicationDecision } from '@/services/bandApplications';

interface BandApplicationsListProps {
  bandId: string;
  onMemberAdded?: () => void;
}

export function BandApplicationsList({ bandId, onMemberAdded }: BandApplicationsListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: applications, isLoading, isError, error } = useQuery({
    queryKey: ['band-applications', bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('band_applications')
        .select(`
          id,
          instrument_role,
          vocal_role,
          message,
          status,
          created_at,
          applicant_profile_id,
          profiles:applicant_profile_id(
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('band_id', bandId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ applicationId, decision }: { applicationId: string; decision: BandApplicationDecision }) => {
      return respondBandApplication(applicationId, decision);
    },
    onSuccess: (result, { decision }) => {
      toast({
        title: decision === 'approve' ? 'Application Approved' : 'Application Rejected',
        description: decision === 'approve' ? 'New member added to the band.' : 'Application has been rejected.',
      });
      queryClient.invalidateQueries({ queryKey: ['band-applications', bandId] });
      queryClient.invalidateQueries({ queryKey: ['band-members', bandId] });
      queryClient.invalidateQueries({ queryKey: ['band', bandId] });
      if (result.status === 'accepted' && onMemberAdded) onMemberAdded();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  if (isLoading) return null;
  if (isError) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Band Applications</CardTitle>
          <CardDescription>{(error as Error)?.message || 'Applications could not be loaded.'}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (!applications || applications.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          <CardTitle>Band Applications</CardTitle>
        </div>
        <CardDescription>{applications.filter((app: any) => app.status === 'pending').length} pending application(s)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {applications.map((app: any) => (
          <div key={app.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div 
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1 min-w-0"
              onClick={() => navigate(`/player/${app.applicant_profile_id}`)}
              title="View player profile & skills"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={app.profiles?.avatar_url} />
                <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium text-primary underline-offset-2 hover:underline flex items-center gap-1">
                  {app.profiles?.display_name || app.profiles?.username || 'Unknown'}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">{app.instrument_role}</Badge>
                  <Badge variant={app.status === 'pending' ? 'secondary' : 'outline'} className="text-xs capitalize">{app.status}</Badge>
                  {app.vocal_role && app.vocal_role !== 'None' && (
                    <Badge variant="outline" className="text-xs">{app.vocal_role}</Badge>
                  )}
                </div>
                {app.message && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-[300px] truncate">{app.message}</p>
                )}
              </div>
            </div>
            {app.status === 'pending' ? (
              <div className="flex gap-2 self-end sm:self-center">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  aria-label={`Reject application from ${app.profiles?.display_name || app.profiles?.username || 'applicant'}`}
                  onClick={() => respondMutation.mutate({ applicationId: app.id, decision: 'reject' })}
                  disabled={respondMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  aria-label={`Approve application from ${app.profiles?.display_name || app.profiles?.username || 'applicant'}`}
                  onClick={() => respondMutation.mutate({ applicationId: app.id, decision: 'approve' })}
                  disabled={respondMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {respondMutation.isPending ? 'Saving...' : 'Approve'}
                </Button>
              </div>
            ) : (
              <Badge variant="outline" className="self-end capitalize sm:self-center">{app.status}</Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
