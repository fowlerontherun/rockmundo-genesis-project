import * as T from "three";
import { Musician } from "@/features/gig-demo-3d/performers";
import type { InstrumentId } from "@/features/gig-demo-3d/instrumentCatalog";
import type { StageRole } from "@/features/gig-demo-3d/liveTypes";
import type { ResolvedEquippedClothing } from "@/features/clothing-preview/equippedClothing";
import { STYLES, modelFile, type PlayerAppearance } from "@/features/player-model/appearance";
import { assemblePlayerModel, disposeModel, loadModelLibrary } from "@/features/player-model/model";
import { visibleTattoosForPresentation, type ResolvedTattooVisual } from "@/features/player-model/tattoos";
import type { ResolvedMerchWearable } from "@/features/player-model/merchWearables";
import type { LuthieryInstrumentVisual } from "@/features/luthiery/luthieryInstrument";

export interface AvatarShareVisual {appearance:PlayerAppearance;role?:StageRole;instrument?:InstrumentId;richClothing?:ResolvedEquippedClothing[];tattoos?:ResolvedTattooVisual[];merchWearable?:ResolvedMerchWearable|null;luthieryInstrument?:LuthieryInstrumentVisual|null}
export const AVATAR_SHARE_PRESET={width:720,height:1080,camera:[2.05,1.55,4.65] as const,target:[0,.9,0] as const,fov:34};

export async function captureAvatarV1ForShare(visual:AvatarShareVisual):Promise<HTMLCanvasElement>{
 const canvas=document.createElement("canvas");canvas.width=AVATAR_SHARE_PRESET.width;canvas.height=AVATAR_SHARE_PRESET.height;
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:"high-performance"});renderer.setSize(canvas.width,canvas.height,false);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.setClearColor(0x000000,0);
 const scene=new T.Scene();const camera=new T.PerspectiveCamera(AVATAR_SHARE_PRESET.fov,canvas.width/canvas.height,.05,30);camera.position.set(...AVATAR_SHARE_PRESET.camera);camera.lookAt(...AVATAR_SHARE_PRESET.target);
 scene.add(new T.HemisphereLight("#e8f0ff","#253044",2));const key=new T.DirectionalLight("#fff0dc",4);key.position.set(-2,4,4);scene.add(key);const rim=new T.DirectionalLight("#8b5cf6",2);rim.position.set(3,2,-2);scene.add(rim);
 let actor:Musician|null=null;let equipment:T.Group|null=null;let library:Awaited<ReturnType<typeof loadModelLibrary>>|null=null;
 try{
  const files=(["masculine","feminine"] as const).flatMap(frame=>STYLES.map(style=>modelFile(frame,style)));library=await loadModelLibrary(files);
  const clothing=visual.richClothing??[];const tattoos=visibleTattoosForPresentation(visual.tattoos??[],{appearance:visual.appearance,clothing,presentation:"stage"});
  const assembled=assemblePlayerModel(library,visual.appearance,tattoos,clothing,"high","stage",visual.merchWearable??null);
  actor=new Musician(assembled,visual.role??"other",[0,0,0],0,undefined,visual.appearance,visual.instrument,undefined,clothing,undefined,undefined,visual.luthieryInstrument??null);disposeModel(assembled);scene.add(actor.root);equipment=actor.equipment;if(equipment)scene.add(equipment);
  actor.update(0,.55,true);renderer.render(scene,camera);return canvas;
 } finally {if(actor)disposeModel(actor.root);if(equipment)disposeModel(equipment);library?.forEach(disposeModel);renderer.dispose();}
}
