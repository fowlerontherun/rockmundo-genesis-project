import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Float, Html, OrbitControls, Stage } from "@react-three/drei";
import { Controllers, XR } from "@react-three/xr";
import type { WebGLRenderer } from "three";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type VirtualConcertViewerProps = {
  className?: string;
  eventName?: string;
  audienceCount?: number;
  onEnterVR?: () => void;
  onExitVR?: () => void;
};

type VrSupportState = "checking" | "supported" | "unsupported";

type XRNavigator = Navigator & {
  xr?: {
    isSessionSupported?: (mode: XRSessionMode) => Promise<boolean>;
    requestSession?: (mode: XRSessionMode, options?: XRSessionInit) => Promise<XRSession>;
  };
};

const fallbackAudience = [32, 48, 56, 61, 78];

const VirtualConcertViewer = ({
  className,
  eventName,
  audienceCount,
  onEnterVR,
  onExitVR,
}: VirtualConcertViewerProps) => {
  const [vrSupport, setVrSupport] = useState<VrSupportState>("checking");
  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null);
  const [session, setSession] = useState<XRSession | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkSupport = async () => {
      if (typeof navigator === "undefined") {
        return;
      }

      const xrNavigator = navigator as XRNavigator;

      try {
        if (!xrNavigator.xr?.isSessionSupported) {
          if (mounted) {
            setVrSupport("unsupported");
          }
          return;
        }

        const supported = await xrNavigator.xr.isSessionSupported("immersive-vr");
        if (mounted) {
          setVrSupport(supported ? "supported" : "unsupported");
        }
      } catch (error) {
        console.warn("Unable to determine WebXR support", error);
        if (mounted) {
          setVrSupport("unsupported");
        }
      }
    };

    void checkSupport();

    return () => {
      mounted = false;
    };
  }, []);

  const derivedAudience = useMemo(() => {
    if (typeof audienceCount === "number") {
      return audienceCount;
    }

    const idx = Math.floor(Math.random() * fallbackAudience.length);
    return fallbackAudience[idx];
  }, [audienceCount]);

  const handleVrToggle = useCallback(async () => {
    if (typeof navigator === "undefined") {
      return;
    }

    const xrNavigator = navigator as XRNavigator;

    if (session) {
      try {
        await session.end();
      } catch (error) {
        console.warn("Unable to exit XR session", error);
      }
      return;
    }

    if (!renderer || !xrNavigator.xr?.requestSession) {
      console.warn("WebXR session request unavailable.");
      return;
    }

    try {
      const xrSession = await xrNavigator.xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor", "bounded-floor"],
        requiredFeatures: ["local-floor"],
      });

      const endHandler = () => {
        setSession(null);
        onExitVR?.();
        xrSession.removeEventListener("end", endHandler);
      };

      xrSession.addEventListener("end", endHandler);

      await renderer.xr.setSession(xrSession);
      setSession(xrSession);
      onEnterVR?.();
    } catch (error) {
      console.error("Failed to start XR session", error);
    }
  }, [onEnterVR, onExitVR, renderer, session]);

  return (
    <div className={cn("relative flex h-full flex-col overflow-hidden rounded-xl border", className)}>
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-1 rounded-md bg-background/80 p-4 shadow-lg backdrop-blur">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Now Staging</p>
        <h3 className="text-xl font-semibold leading-tight">{eventName ?? "Untitled Virtual Concert"}</h3>
        <p className="text-sm text-muted-foreground">
          {derivedAudience.toLocaleString()} fans waiting in the lobby
        </p>
        {vrSupport !== "supported" && (
          <p className="text-xs text-amber-500">
            {vrSupport === "checking"
              ? "Checking your device for VR support..."
              : "Enter in desktop or mobile mode. WebXR is not available on this device."}
          </p>
        )}
      </div>

      <div className="absolute right-4 top-4 z-10">
        <Button
          type="button"
          size="sm"
          variant={session ? "secondary" : "default"}
          disabled={vrSupport !== "supported" || !renderer}
          onClick={handleVrToggle}
          className="border border-border bg-background/80 text-foreground shadow-md backdrop-blur hover:bg-background"
        >
          {session ? "Exit VR stage" : "Enter VR stage"}
        </Button>
      </div>

      <Canvas
        className="h-full w-full"
        camera={{ position: [0, 2, 6], fov: 50 }}
        shadows
        gl={{ antialias: true }}
        onCreated={(state) => {
          state.gl.xr.enabled = true;
          setRenderer(state.gl);
        }}
      >
        <Suspense fallback={<Html center className="text-sm font-medium">Loading virtual stage...</Html>}>
          <XR>
            <ambientLight intensity={0.5} />
            <directionalLight castShadow position={[5, 8, 3]} intensity={1.2} shadow-mapSize-width={2048} shadow-mapSize-height={2048} />

            <Stage adjustCamera={false} contactShadow={{ opacity: 0.4, blur: 2 }} intensity={0.9}>
              <Float speed={1.5} rotationIntensity={0.6} floatIntensity={0.8}>
                <mesh castShadow position={[0, 1.5, 0]}>
                  <icosahedronGeometry args={[0.8, 1]} />
                  <meshStandardMaterial color="#a855f7" emissive="#7c3aed" emissiveIntensity={1.2} metalness={0.1} roughness={0.3} />
                </mesh>
              </Float>

              <mesh castShadow position={[-1.8, 1, -1.2]}>
                <boxGeometry args={[0.6, 0.6, 0.6]} />
                <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.6} metalness={0.2} roughness={0.4} />
              </mesh>

              <mesh castShadow position={[1.8, 0.7, -1.4]} rotation={[0.2, 0.6, -0.1]}>
                <torusKnotGeometry args={[0.4, 0.12, 120, 16]} />
                <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={0.8} metalness={0.3} roughness={0.2} />
              </mesh>

              <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
                <circleGeometry args={[8, 64]} />
                <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.6} />
              </mesh>
            </Stage>

            <Controllers />
          </XR>

          <Environment preset="night" background />
          <OrbitControls enablePan={false} enableDamping dampingFactor={0.05} minDistance={3} maxDistance={12} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default VirtualConcertViewer;
