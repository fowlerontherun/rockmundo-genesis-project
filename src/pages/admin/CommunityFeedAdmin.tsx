import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Pin, Trash2, MessageSquare, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CommunityFeedAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: posts } = useQuery({
    queryKey: ["community-feed-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_feed_posts")
        .select("*, profile:profiles(username, display_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const toggleSpotlight = useMutation({
    mutationFn: async ({ id, isSpotlight }: { id: string; isSpotlight: boolean }) => {
      const { error } = await supabase
        .from("community_feed_posts")
        .update({ is_spotlight: !isSpotlight })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-feed-posts"] });
      toast({ title: "Post spotlight updated" });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("community_feed_posts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-feed-posts"] });
      toast({ title: "Post deleted successfully" });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Community Feed Admin</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recent Posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Author</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Spotlight</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts?.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">
                    {post.profile?.display_name || post.profile?.username}
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {post.content}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{post.category || "General"}</Badge>
                  </TableCell>
                  <TableCell>
                    {post.is_spotlight && (
                      <Badge variant="default">Pinned</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(post.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toggleSpotlight.mutate({ id: post.id, isSpotlight: post.is_spotlight || false })
                        }
                      >
                        <Pin className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePost.mutate(post.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
