// @ts-nocheck
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import {
  applyChoiceToState,
  createInitialNarrativeState,
  getNarrativeStory,
  isChoiceAvailable,
  parseFlags,
  type NarrativeChoice,
  type NarrativeStateRecord,
} from "@/lib/narratives";
import type { Database } from "@/lib/supabase-types";

const STORY_STATE_QUERY_KEY = "narrative-story-state" as const;

type StoryStateRow = Database["public"]["Tables"]["story_states"]["Row"];

type StoryChoiceInsert = Database["public"]["Tables"]["story_choices"]["Insert"];

type StoryStateInsert = Database["public"]["Tables"]["story_states"]["Insert"];

const mapRowToState = (row: StoryStateRow): NarrativeStateRecord => ({
  id: row.id,
  storyId: row.story_id,
  currentNodeId: row.current_node_id,
  visitedNodeIds: row.visited_node_ids ?? [row.current_node_id],
  flags: parseFlags(row.flags),
  profileId: row.profile_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const NarrativeStoryPage = () => {
  const params = useParams();
  const { storyId } = params;
  const story = getNarrativeStory(storyId ?? "");
  const { user, loading: authLoading } = useAuth();
  const { profile } = useGameData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);

  const {
    data: storyState,
    isLoading: storyStateLoading,
    isError: storyStateError,
    error,
    refetch,
  } = useQuery({
    queryKey: [STORY_STATE_QUERY_KEY, storyId, user?.id],
    enabled: Boolean(user && story && !authLoading),
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<NarrativeStateRecord> => {
      if (!user || !story) {
        throw new Error("Story and user must be available");
      }

      const { data, error: fetchError } = await supabase
        .from("story_states")
        .select("*")
        .eq("story_id", story.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        return mapRowToState(data);
      }

      const initialState = createInitialNarrativeState(story);

      const payload: StoryStateInsert = {
        story_id: story.id,
        user_id: user.id,
        profile_id: profile?.id ?? null,
        current_node_id: initialState.currentNodeId,
        visited_node_ids: initialState.visitedNodeIds,
        flags: initialState.flags,
      };

      const { data: inserted, error: insertError } = await supabase
        .from("story_states")
        .insert(payload)
        .select()
        .single();

      if (insertError || !inserted) {
        throw insertError ?? new Error("Failed to initialize story state");
      }

      return mapRowToState(inserted);
    },
  });

  const handleChoiceResult = (choice: NarrativeChoice, message?: string) => {
    const description = message ?? choice.resultSummary ?? `You chose ${choice.label}.`;
    setLastOutcome(description);
    toast({
      title: "Choice recorded",
      description,
    });
  };

  const applyChoiceMutation = useMutation({
    mutationFn: async (choiceId: string) => {
      if (!story || !storyState || !user) {
        throw new Error("Story state is not ready");
      }

      const currentNode = story.nodes[storyState.currentNodeId];
      if (!currentNode) {
        throw new Error("Current story node not found");
      }

      const selectedChoice = currentNode.choices.find((choice) => choice.id === choiceId);
      if (!selectedChoice) {
        throw new Error("Choice not found for this node");
      }

      if (!isChoiceAvailable(selectedChoice, storyState)) {
        throw new Error("Choice is not currently available");
      }

      const nextState = applyChoiceToState(storyState, selectedChoice);

      const { data: updated, error: updateError } = await supabase
        .from("story_states")
        .update({
          current_node_id: nextState.currentNodeId,
          visited_node_ids: nextState.visitedNodeIds,
          flags: nextState.flags,
          profile_id: profile?.id ?? storyState.profileId ?? null,
        })
        .eq("id", storyState.id)
        .select()
        .single();

      if (updateError || !updated) {
        throw updateError ?? new Error("Failed to update story state");
      }

      const choiceRecord: StoryChoiceInsert = {
        story_state_id: storyState.id,
        user_id: user.id,
        story_id: story.id,
        node_id: currentNode.id,
        choice_id: selectedChoice.id,
        choice_label: selectedChoice.label,
        result_summary: selectedChoice.resultSummary ?? null,
        metadata: {
          requiredFlags: selectedChoice.requiredFlags ?? undefined,
          setFlags: selectedChoice.setFlags ?? undefined,
          clearFlags: selectedChoice.clearFlags ?? undefined,
        },
      };

      const { error: choiceInsertError } = await supabase.from("story_choices").insert(choiceRecord);
      if (choiceInsertError) {
        throw choiceInsertError;
      }

      return {
        state: mapRowToState(updated),
        choice: selectedChoice,
      };
    },
    onSuccess: ({ state, choice }) => {
      queryClient.setQueryData([STORY_STATE_QUERY_KEY, storyId, user?.id], state);
      handleChoiceResult(choice);
    },
    onError: (mutationError) => {
      console.error("Failed to apply choice", mutationError);
      toast({
        title: "Unable to continue the story",
        description: mutationError instanceof Error ? mutationError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const loading = authLoading || storyStateLoading;

  const currentNode = useMemo(() => {
    if (!story || !storyState) {
      return undefined;
    }
    return story.nodes[storyState.currentNodeId];
  }, [story, storyState]);

  const visitedNodes = useMemo(() => {
    if (!story || !storyState) {
      return [];
    }

    return storyState.visitedNodeIds
      .map((nodeId) => story.nodes[nodeId])
      .filter((node): node is NonNullable<typeof node> => Boolean(node));
  }, [story, storyState]);

  const availableChoices = useMemo(() => {
    if (!storyState || !currentNode) {
      return [];
    }

    return currentNode.choices.filter((choice) => isChoiceAvailable(choice, storyState));
  }, [storyState, currentNode]);

  const lockedChoices = useMemo(() => {
    if (!storyState || !currentNode) {
      return [];
    }

    return currentNode.choices.filter((choice) => !isChoiceAvailable(choice, storyState));
  }, [storyState, currentNode]);

  if (!story) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Story not found</CardTitle>
            <CardDescription>The requested narrative does not exist yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user && !authLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Sign in to explore narratives</CardTitle>
            <CardDescription>You need to be signed in to continue your story.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/auth")}>Sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex flex-wrap gap-2">
          {story.themeTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="uppercase tracking-wide">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-3xl font-bold">
            <Sparkles className="h-6 w-6 text-primary" />
            {story.title}
          </CardTitle>
          <CardDescription>{story.summary}</CardDescription>
        </CardHeader>
      </Card>

      {loading && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      )}

      {storyStateError && !loading && (
        <Alert variant="destructive">
          <AlertTitle>We couldn't load your progress</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Something went wrong while loading this narrative."}
          </AlertDescription>
          <div className="mt-4">
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
          </div>
        </Alert>
      )}

      {!loading && storyState && currentNode && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{currentNode.title}</CardTitle>
              <CardDescription>{currentNode.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentNode.atmosphere && (
                <p className="text-sm italic text-muted-foreground">{currentNode.atmosphere}</p>
              )}
              {currentNode.body.map((paragraph, index) => (
                <p key={index} className="leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
              {currentNode.spotlight && (
                <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Spotlight:</span> {currentNode.spotlight}
                </div>
              )}
              {currentNode.endingType && (
                <Badge variant="outline" className="uppercase">
                  {currentNode.endingType === "success"
                    ? "Triumphant ending"
                    : currentNode.endingType === "failure"
                      ? "Hard lesson"
                      : "Quiet resolution"}
                </Badge>
              )}
            </CardContent>
          </Card>

          {visitedNodes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Story progress</CardTitle>
                <CardDescription>Scenes you've explored so far.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-64">
                  <ol className="space-y-4 pr-4">
                    {visitedNodes.map((node, index) => (
                      <li key={node.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase text-muted-foreground">Step {index + 1}</p>
                            <p className="font-semibold text-foreground">{node.title}</p>
                            <p className="text-sm text-muted-foreground">{node.description}</p>
                          </div>
                          {index === visitedNodes.length - 1 && (
                            <Badge variant="secondary">Current</Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {lastOutcome && (
            <Alert className="border-primary/50 bg-primary/5">
              <AlertTitle>Recent outcome</AlertTitle>
              <AlertDescription>{lastOutcome}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Choose your next move</CardTitle>
              <CardDescription>Every decision shapes the legend your band carries forward.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {availableChoices.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  This branch of the story has reached its current conclusion. Check back later for new narrative beats.
                </p>
              )}

              {availableChoices.map((choice) => (
                <div key={choice.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{choice.label}</h3>
                      {choice.description && (
                        <p className="text-sm text-muted-foreground">{choice.description}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => applyChoiceMutation.mutate(choice.id)}
                      disabled={applyChoiceMutation.isPending}
                    >
                      {applyChoiceMutation.isPending ? "Processing..." : "Commit to this choice"}
                    </Button>
                  </div>
                </div>
              ))}

              {lockedChoices.length > 0 && (
                <div className="space-y-3 rounded-lg border border-dashed p-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Opportunities awaiting future decisions
                  </p>
                  {lockedChoices.map((choice) => (
                    <div key={choice.id} className="rounded-md bg-muted/50 p-3">
                      <p className="text-sm font-semibold text-muted-foreground">{choice.label}</p>
                      {choice.description && (
                        <p className="text-xs text-muted-foreground/80">{choice.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default NarrativeStoryPage;
