import type { ResolvedInstrumentSkinVisual } from '@/features/instrument-skins/instrumentSkin';
import * as T from "three";
import { Musician } from "@/features/gig-demo-3d/performers";
import type { InstrumentId } from "@/features/gig-demo-3d/instrumentCatalog";
import type { StageRole } from "@/features/gig-demo-3d/liveTypes";
import type { ResolvedEquippedClothing } from "@/features/clothing-preview/equippedClothing";
import { loadOptionalCuratedGarments, requiredCuratedGarmentFiles } from "@/features/clothing-preview/curatedGarmentAssets";
import { requiredCuratedDonorModelFiles } from "@/features/clothing-preview/curatedDonorGarments";
import type { PlayerAppearance } from "@/features/player-model/appearance";
import { assemblePlayerModel, disposeModel, loadModelLibrary, requiredModelFiles } from "@/features/player-model/model";
import { visibleTattoosForPresentation, type ResolvedTattooVisual } from "@/features/player-model/tattoos";
import type { ResolvedMerchWearable } from "@/features/player-model/merchWearables";
import type { LuthieryInstrumentVisual } from "@/features/luthiery/luthieryInstrument";


export interface AvatarCapture {
  dataUrl: string;
  width: number;
  height: number;
}

/** Serializable snapshot of the canonical Avatar V1 canvas for historical share cards. */
export function captureAvatarCanvas(canvas: HTMLCanvasElement): AvatarCapture {
  return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}

/** Decode a stored avatar snapshot without invoking a second avatar renderer. */
export function loadCaptureImage(capture: AvatarCapture): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Avatar snapshot could not be loaded"));
    image.src = capture.dataUrl;
  });
}

export interface AvatarShareVisual {instrumentSkin?:ResolvedInstrumentSkinVisual|null;appearance:PlayerAppearance;role?:StageRole;instrument?:InstrumentId;richClothing?:ResolvedEquippedClothing[];tattoos?:ResolvedTattooVisual[];merchWearable?:ResolvedMerchWearable|null;luthieryInstrument?:LuthieryInstrumentVisual|null}
export const AVATAR_SHARE_PRESET={width:720,height:1080,camera:[2.05,1.55,4.65] as const,target:[0,.9,0] as const,fov:34};

export async function captureAvatarV1ForShare(visual:AvatarShareVisual):Promise<HTMLCanvasElement>{
 const canvas=document.createElement("canvas");canvas.width=AVATAR_SHARE_PRESET.width;canvas.height=AVATAR_SHARE_PRESET.height;
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:"high-performance"});renderer.setSize(canvas.width,canvas.height,false);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.setClearColor(0x000000,0);
 const scene=new T.Scene();const camera=new T.PerspectiveCamera(AVATAR_SHARE_PRESET.fov,canvas.width/canvas.height,.05,30);camera.position.set(...AVATAR_SHARE_PRESET.camera);camera.lookAt(...AVATAR_SHARE_PRESET.target);
 scene.add(new T.HemisphereLight("#e8f0ff","#253044",2));const key=new T.DirectionalLight("#fff0dc",4);key.position.set(-2,4,4);scene.add(key);const rim=new T.DirectionalLight("#8b5cf6",2);rim.position.set(3,2,-2);scene.add(rim);
 let actor:Musician|null=null;let equipment:T.Group|null=null;let library:Awaited<ReturnType<typeof loadModelLibrary>>|null=null;
 try{
  const clothing=visual.richClothing??[];
  const frame=visual.appearance.body.frame;
  // Match the stage renderer: donor and uploaded curated garment assets must
  // be present before the musician is assembled, or equipped clothes disappear
  // from saved share images even though they appear correctly at gigs.
  const donorFiles=requiredCuratedDonorModelFiles(clothing,frame);
  const curatedFiles=requiredCuratedGarmentFiles(clothing,frame);
  // A single portrait needs only the current character's head/body/clothing
  // styles plus curated donor sources. Loading every style and the opposite
  // frame adds unnecessary GLB downloads and can fail on an unused asset.
  const files=[...requiredModelFiles([visual.appearance]),...donorFiles];
  library=await loadModelLibrary([...new Set(files)]);
  await loadOptionalCuratedGarments(library,curatedFiles);
  // Gigs can continue without an optional garment, but a personal portrait
  // must not silently publish the WRONG outfit when garment storage is down.
  if (curatedFiles.some(file=>!library!.has(file))) {
    throw new Error("Equipped curated clothing could not load. Retry the avatar before sharing.");
  }
  const tattoos=visibleTattoosForPresentation(visual.tattoos??[],{appearance:visual.appearance,clothing,presentation:"stage"});
  const assembled=assemblePlayerModel(library,visual.appearance,tattoos,clothing,"high","stage",visual.merchWearable??null);
  actor=new Musician(assembled,visual.role??"other",[0,0,0],0,undefined,visual.appearance,visual.instrument,undefined,clothing,visual.instrumentSkin,library,visual.luthieryInstrument??null);disposeModel(assembled);scene.add(actor.root);equipment=actor.equipment;if(equipment)scene.add(equipment);
  actor.update(0,.55,true);
  renderer.render(scene,camera);
  // Copy the complete WebGL frame to a 2D canvas while the context is still
  // alive. An off-screen/cleared WebGL buffer must never be exported as an avatar.
  const captured = document.createElement("canvas");
  captured.width = canvas.width;
  captured.height = canvas.height;
  const context = captured.getContext("2d");
  if (!context) throw new Error("Unable to create avatar share snapshot");
  context.drawImage(canvas, 0, 0);
  const pixels = context.getImageData(0, 0, captured.width, captured.height).data;
  let visibleSamples = 0;
  for (let i = 3; i < pixels.length; i += 64) {
    if (pixels[i] > 8 && ++visibleSamples > 64) break;
  }
  if (visibleSamples <= 64) throw new Error("Avatar share render was blank");
  return captured;
 } finally {if(actor)disposeModel(actor.root);if(equipment)disposeModel(equipment);library?.forEach(disposeModel);renderer.dispose();}
}
