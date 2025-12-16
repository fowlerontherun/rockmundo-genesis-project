import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Play, 
  Radio, 
  BarChart3, 
  Music2, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  RefreshCw
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  data?: any;
}

export function ReleaseTestTools() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const runTest = async (name: string, fn: () => Promise<any>) => {
    try {
      const result = await fn();
      return { name, success: true, message: "Success", data: result };
    } catch (error: any) {
      return { name, success: false, message: error.message, data: null };
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);
    const newResults: TestResult[] = [];

    // Test 1: Complete Manufacturing
    const manufacturingResult = await runTest("Complete Manufacturing", async () => {
      const { data, error } = await supabase.functions.invoke("complete-release-manufacturing");
      if (error) throw error;
      return data;
    });
    newResults.push(manufacturingResult);
    setResults([...newResults]);

    // Test 2: Auto-distribute Streaming
    const distributeResult = await runTest("Auto-distribute Streaming", async () => {
      const { data, error } = await supabase.functions.invoke("auto-distribute-streaming");
      if (error) throw error;
      return data;
    });
    newResults.push(distributeResult);
    setResults([...newResults]);

    // Test 3: Update Daily Streams
    const streamsResult = await runTest("Update Daily Streams", async () => {
      const { data, error } = await supabase.functions.invoke("update-daily-streams");
      if (error) throw error;
      return data;
    });
    newResults.push(streamsResult);
    setResults([...newResults]);

    // Test 4: Simulate Radio Plays
    const radioResult = await runTest("Simulate Radio Plays", async () => {
      const { data, error } = await supabase.functions.invoke("simulate-radio-plays");
      if (error) throw error;
      return data;
    });
    newResults.push(radioResult);
    setResults([...newResults]);

    // Test 5: Update Music Charts
    const chartsResult = await runTest("Update Music Charts", async () => {
      const { data, error } = await supabase.functions.invoke("update-music-charts");
      if (error) throw error;
      return data;
    });
    newResults.push(chartsResult);
    setResults([...newResults]);

    setIsRunning(false);
    
    const successCount = newResults.filter(r => r.success).length;
    if (successCount === newResults.length) {
      toast.success("All tests passed!");
    } else {
      toast.error(`${newResults.length - successCount} test(s) failed`);
    }
  };

  const runSingleTest = async (testName: string, fnName: string) => {
    setIsRunning(true);
    const result = await runTest(testName, async () => {
      const { data, error } = await supabase.functions.invoke(fnName);
      if (error) throw error;
      return data;
    });
    
    setResults(prev => {
      const existing = prev.findIndex(r => r.name === testName);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = result;
        return updated;
      }
      return [...prev, result];
    });
    
    setIsRunning(false);
    
    if (result.success) {
      toast.success(`${testName}: ${result.data?.message || "Success"}`);
    } else {
      toast.error(`${testName}: ${result.message}`);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed border-amber-500/50 bg-amber-500/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-amber-500" />
                  Release Flow Test Tools
                </CardTitle>
                <CardDescription>
                  Manually trigger release pipeline functions for testing
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-amber-500 border-amber-500">
                DEV
              </Badge>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={runAllTests} 
                disabled={isRunning}
                className="gap-2"
              >
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run All Tests
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => runSingleTest("Complete Manufacturing", "complete-release-manufacturing")}
                disabled={isRunning}
                className="gap-2 justify-start"
              >
                <Music2 className="h-4 w-4" />
                Complete Manufacturing
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => runSingleTest("Auto-distribute Streaming", "auto-distribute-streaming")}
                disabled={isRunning}
                className="gap-2 justify-start"
              >
                <Play className="h-4 w-4" />
                Auto-distribute Streaming
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => runSingleTest("Update Daily Streams", "update-daily-streams")}
                disabled={isRunning}
                className="gap-2 justify-start"
              >
                <BarChart3 className="h-4 w-4" />
                Update Daily Streams
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => runSingleTest("Simulate Radio Plays", "simulate-radio-plays")}
                disabled={isRunning}
                className="gap-2 justify-start"
              >
                <Radio className="h-4 w-4" />
                Simulate Radio Plays
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => runSingleTest("Update Music Charts", "update-music-charts")}
                disabled={isRunning}
                className="gap-2 justify-start"
              >
                <BarChart3 className="h-4 w-4" />
                Update Music Charts
              </Button>
            </div>

            {results.length > 0 && (
              <div className="space-y-2 mt-4">
                <h4 className="text-sm font-medium">Test Results:</h4>
                <div className="space-y-2">
                  {results.map((result, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg text-sm ${
                        result.success 
                          ? "bg-green-500/10 border border-green-500/30" 
                          : "bg-red-500/10 border border-red-500/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">{result.name}</span>
                      </div>
                      {result.data && (
                        <pre className="mt-2 text-xs bg-background/50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      )}
                      {!result.success && result.message && (
                        <p className="mt-1 text-xs text-red-400">{result.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
