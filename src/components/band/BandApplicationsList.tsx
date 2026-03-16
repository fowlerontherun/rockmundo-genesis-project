import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Check, X, ClipboardList, User, ExternalLink } from 'lucide-react';

interface BandApplicationsListProps {
  bandId: string;
  onMemberAdded?: () => void;
}

export function BandApplicationsList({ bandId, onMemberAdded }: BandApplicationsListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: applications, isLoading } = useQuery({
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
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ applicationId, status, application }: { applicationId: string; status: 'accepted' | 'rejected'; application: any }) => {
      // Update application status
      const { error: updateError } = await supabase
        .from('band_applications')
        .update({ status, responded_at: new Date().toISOString() })
        .eq('id', applicationId);
      if (updateError) throw updateError;

      // If accepted, add as band member
      if (status === 'accepted') {
        const { error: memberError } = await supabase
          .from('band_members')
          .insert({
            band_id: bandId,
            user_id: null, // Will need to look up from profile
            profile_id: application.applicant_profile_id,
            instrument_role: application.instrument_role,
            vocal_role: application.vocal_role || null,
            role: 'member',
            member_status: 'active',
          });
        
        // Get user_id from profile and update
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', application.applicant_profile_id)
          .single();
        
        if (profile?.user_id) {
          await supabase
            .from('band_members')
            .update({ user_id: profile.user_id })
            .eq('band_id', bandId)
            .eq('profile_id', application.applicant_profile_id);
        }
        
        if (memberError) throw memberError;
      }
    },
    onSuccess: (_, { status }) => {
      toast({
        title: status === 'accepted' ? 'Application Accepted' : 'Application Rejected',
        description: status === 'accepted' ? 'New member added to the band!' : 'Application has been rejected.',
      });
      queryClient.invalidateQueries({ queryKey: ['band-applications', bandId] });
      if (onMemberAdded) onMemberAdded();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  if (isLoading) return null;
  if (!applications || applications.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          <CardTitle>Pending Applications</CardTitle>
        </div>
        <CardDescription>{applications.length} pending application(s)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {applications.map((app: any) => (
          <div key={app.id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={app.profiles?.avatar_url} />
                <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{app.profiles?.display_name || app.profiles?.username || 'Unknown'}</p>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">{app.instrument_role}</Badge>
                  {app.vocal_role && app.vocal_role !== 'None' && (
                    <Badge variant="outline" className="text-xs">{app.vocal_role}</Badge>
                  )}
                </div>
                {app.message && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-[300px] truncate">{app.message}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => respondMutation.mutate({ applicationId: app.id, status: 'rejected', application: app })}
                disabled={respondMutation.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => respondMutation.mutate({ applicationId: app.id, status: 'accepted', application: app })}
                disabled={respondMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Accept
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
