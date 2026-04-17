import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Newspaper } from "lucide-react";
import { usePublishCampaignArticle } from "@/hooks/useElectionCampaign";

interface Props {
  electionId: string;
  candidateId: string;
}

export function CampaignArticleEditor({ electionId, candidateId }: Props) {
  const publish = usePublishCampaignArticle();
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Newspaper className="h-5 w-5" /> Publish a Campaign Article
        </CardTitle>
        <p className="text-xs text-muted-foreground">Featured in Today's News during the campaign window.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Headline</Label>
          <Input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={140} />
        </div>
        <div>
          <Label>Body (markdown supported)</Label>
          <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
        </div>
        <Button
          disabled={!headline || !body || publish.isPending}
          onClick={() =>
            publish.mutate(
              { election_id: electionId, candidate_id: candidateId, headline, body },
              {
                onSuccess: () => {
                  setHeadline("");
                  setBody("");
                },
              }
            )
          }
        >
          {publish.isPending ? "Publishing…" : "Publish Article"}
        </Button>
      </CardContent>
    </Card>
  );
}
