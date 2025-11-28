import { useGLTF } from "@react-three/drei";
import { Suspense } from "react";

interface ModelLoaderProps {
  modelPath: string | null;
  fallback?: React.ReactNode;
  scale?: number;
  position?: [number, number, number];
}

function Model({ modelPath, scale = 1, position = [0, 0, 0] }: { modelPath: string; scale: number; position: [number, number, number] }) {
  const { scene } = useGLTF(modelPath);
  
  return <primitive object={scene} scale={scale} position={position} />;
}

export const ModelLoader = ({ modelPath, fallback, scale = 1, position = [0, 0, 0] }: ModelLoaderProps) => {
  if (!modelPath) {
    return <>{fallback}</>;
  }

  return (
    <Suspense fallback={fallback}>
      <Model modelPath={modelPath} scale={scale} position={position} />
    </Suspense>
  );
};
