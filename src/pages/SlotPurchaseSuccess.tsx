import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { PageLayout } from "@/components/ui/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export default function SlotPurchaseSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setErrorMsg("No session ID found");
      return;
    }

    const fulfill = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("fulfill-slot-purchase", {
          body: { session_id: sessionId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setStatus("success");
        queryClient.invalidateQueries({ queryKey: ["character-slots"] });
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err.message || "Failed to fulfill purchase");
      }
    };

    fulfill();
  }, [sessionId, queryClient]);

  return (
    <PageLayout>
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            {status === "loading" && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground">Activating your new character slot...</p>
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <h2 className="text-xl font-bold">Slot Unlocked!</h2>
                <p className="text-muted-foreground">Your new character slot is ready. You can now create another character.</p>
                <div className="flex gap-2 justify-center pt-2">
                  <Button onClick={() => navigate("/characters/new")}>Create Character</Button>
                  <Button variant="outline" onClick={() => navigate("/dashboard")}>Dashboard</Button>
                </div>
              </>
            )}
            {status === "error" && (
              <>
                <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
                <h2 className="text-xl font-bold">Something went wrong</h2>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
                <Button variant="outline" onClick={() => navigate("/buy-character-slot")}>Try Again</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
