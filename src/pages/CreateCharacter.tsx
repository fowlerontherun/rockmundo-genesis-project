import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/ui/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";

export default function CreateCharacter() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createCharacter } = useCharacterSlots();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    createCharacter.mutate(undefined, {
      onError: (error: any) => {
        toast({
          title: "Unable to create character",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
      },
    });
  }, [createCharacter, toast]);

  useEffect(() => {
    if (createCharacter.isSuccess) {
      window.location.assign("/onboarding?newCharacter=1");
    }
  }, [createCharacter.isSuccess]);

  return (
    <PageLayout>
      <div className="mx-auto flex min-h-[50vh] w-full max-w-lg items-center justify-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Creating your new character</CardTitle>
            <CardDescription>
              We&apos;re preparing a fresh slot and making it your active character.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {createCharacter.isPending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Setting up your new character profile...
              </div>
            ) : createCharacter.isError ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive">
                  {(createCharacter.error as Error)?.message || "Could not create character."}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      createCharacter.mutate(undefined, {
                        onError: (error: any) => {
                          toast({
                            title: "Unable to create character",
                            description: error?.message || "Please try again.",
                            variant: "destructive",
                          });
                        },
                      })
                    }
                  >
                    Try again
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/buy-character-slot")}>Back</Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
