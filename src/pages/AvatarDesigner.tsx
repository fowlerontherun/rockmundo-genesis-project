import { lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
const PlayerModelEditor = lazy(() => import("@/features/player-model/PlayerModelEditor"));
import { Sparkles } from "lucide-react";
import { AiAvatarCreator } from "@/components/avatar-system/AiAvatarCreator";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

const AvatarDesigner = () => {
  return (
    <FMPageScaffold
      title="Avatar Designer"
      subtitle="Create your stage model and profile portrait"
      icon={Sparkles}
      backTo="/hub/character"
    >
      <Tabs defaultValue="stage">
        <TabsList className="mb-5"><TabsTrigger value="stage">3D stage model</TabsTrigger><TabsTrigger value="portrait">Profile portrait</TabsTrigger></TabsList>
        <TabsContent value="stage"><Suspense fallback={<p role="status" className="p-8">Loading model designer…</p>}><PlayerModelEditor /></Suspense></TabsContent>
        <TabsContent value="portrait"><AiAvatarCreator /></TabsContent>
      </Tabs>
    </FMPageScaffold>
  );
};

export default AvatarDesigner;
