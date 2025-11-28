import { CameraController } from "./CameraController";

type CameraMode = 'pov' | 'orbit' | 'free' | 'cinematic';

interface CameraRigProps {
  crowdMood: number;
  stageTemplateId?: string | null;
  mode?: CameraMode;
  zoomLevel?: number;
}

export const CameraRig = ({ 
  crowdMood, 
  stageTemplateId,
  mode = 'pov',
  zoomLevel = 13
}: CameraRigProps) => {
  return (
    <CameraController 
      mode={mode} 
      crowdMood={crowdMood} 
      zoomLevel={zoomLevel} 
    />
  );
};
