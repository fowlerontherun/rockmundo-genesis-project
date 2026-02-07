import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Palette } from "lucide-react";
import { AiAvatarCreator } from "@/components/avatar-system/AiAvatarCreator";
import { SvgCharacterCreator } from "@/components/character-creator";

const AvatarDesigner = () => {
  const [activeTab, setActiveTab] = useState("ai");

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 space-y-4">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Avatar Designer</h1>
        <p className="text-sm text-muted-foreground">
          Create your unique look
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai" className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Photo Avatar
          </TabsTrigger>
          <TabsTrigger value="classic" className="gap-2">
            <Palette className="h-4 w-4" />
            Classic Creator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-4">
          <AiAvatarCreator onSwitchToClassic={() => setActiveTab("classic")} />
        </TabsContent>

        <TabsContent value="classic" className="mt-4">
          <SvgCharacterCreator />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AvatarDesigner;
