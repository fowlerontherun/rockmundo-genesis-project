import { Html } from "@react-three/drei";
import { Loader2 } from "lucide-react";

export const LoadingScreen = () => {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-4 text-white">
        <Loader2 className="h-12 w-12 animate-spin" />
        <div className="text-lg font-bebas">Loading 3D Stage...</div>
      </div>
    </Html>
  );
};
