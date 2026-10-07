import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Image as ImageIcon, Share2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useGigPlayerModels } from "@/features/player-model/usePlayerModel";
import { canvasBlob, renderShareMoment, shareFilename } from "./canvas";
import { downloadBlob, nativeShare, withReferral } from "./share";
import type { ShareFormat, ShareMoment } from "./types";
import { captureAvatarV1ForShare, loadCaptureImage } from "./avatarCapture";
import type { CharacterProfileShareMoment } from "./characterProfile";

export function ShareMomentSheet({moment,open,onOpenChange}:{moment:ShareMoment|null;open:boolean;onOpenChange:(open:boolean)=>void}){
 const {toast}=useToast(); const {profileId}=useActiveProfile(); const models=useGigPlayerModels(open&&profileId?[profileId]:[]);
 const canvasRef=useRef<HTMLCanvasElement|null>(null); const avatarRef=useRef<CanvasImageSource|null>(null); const [format,setFormat]=useState<ShareFormat>("square"); const [done,setDone]=useState<string|null>(null); const [avatarVersion,setAvatarVersion]=useState(0);
 useEffect(()=>{let cancelled=false;avatarRef.current=null;if(!open||!moment)return;const embedded=(moment as CharacterProfileShareMoment).avatar;
  const load=async()=>{try{
   if(embedded) return await loadCaptureImage(embedded);
   if(!profileId||!models.data?.appearances[profileId]) return null;
   return await captureAvatarV1ForShare({appearance:models.data.appearances[profileId],richClothing:models.data.richClothing[profileId]??[],tattoos:models.data.tattoos?.[profileId]??[],merchWearable:models.data.merchWearables?.[profileId]??null,luthieryInstrument:models.data.luthieryInstruments?.[profileId]?.[0]??null});
  }catch{return null}};
  void load().then(avatar=>{if(!cancelled){avatarRef.current=avatar;setAvatarVersion(v=>v+1)}});return()=>{cancelled=true};
 },[open,moment,profileId,models.data]);
 useEffect(()=>{if(open&&moment&&canvasRef.current)renderShareMoment(canvasRef.current,moment,format,avatarRef.current)},[open,moment,format,avatarVersion]);
 if(!moment)return null;
 const url=moment.destinationUrl?withReferral(moment.destinationUrl,moment.referralCode):undefined; const text=[moment.headline,moment.subheadline].filter(Boolean).join(" — ");
 const blob=()=>canvasRef.current?canvasBlob(canvasRef.current):Promise.reject(new Error("Preview unavailable")); const flash=(k:string)=>{setDone(k);setTimeout(()=>setDone(v=>v===k?null:v),1400)};
 const share=async()=>{try{const b=await blob();const file=new File([b],shareFilename(moment,format),{type:"image/png"});const result=await nativeShare({title:moment.headline,text,url,file});if(result==="unsupported"){await navigator.clipboard.writeText([text,url].filter(Boolean).join("\n"));toast({title:"Share link copied"});}else if(result==="shared")flash("share")}catch(e){toast({title:"Unable to share",description:(e as Error).message,variant:"destructive"})}};
 return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg"><SheetHeader><SheetTitle className="flex items-center gap-2"><Share2 className="h-4 w-4"/>Share your RockMundo moment</SheetTitle><SheetDescription>Choose a format, preview the branded card, then share the image or link.</SheetDescription></SheetHeader><div className="mt-4 space-y-4"><div className="flex gap-2">{(["square","story","landscape"] as ShareFormat[]).map(f=><Button key={f} size="sm" variant={format===f?"default":"outline"} onClick={()=>setFormat(f)} className="capitalize">{f}</Button>)}</div><div className="rounded-lg border bg-muted/30 p-2"><canvas ref={canvasRef} className="h-auto w-full rounded-md" aria-label="RockMundo share card preview"/></div><div className="grid grid-cols-2 gap-2"><Button onClick={share}>{done==="share"?<Check/>:<Share2/>}Share…</Button><Button variant="secondary" onClick={async()=>{const b=await blob();downloadBlob(b,shareFilename(moment,format));flash("download")}}>{done==="download"?<Check/>:<Download/>}Download PNG</Button><Button variant="outline" onClick={async()=>{try{const b=await blob();await navigator.clipboard.write([new ClipboardItem({"image/png":b})]);flash("image")}catch{toast({title:"Copy image unsupported",description:"Download the PNG instead.",variant:"destructive"})}}}>{done==="image"?<Check/>:<ImageIcon/>}Copy image</Button><Button variant="outline" onClick={async()=>{await navigator.clipboard.writeText([text,url].filter(Boolean).join("\n"));flash("link")}}>{done==="link"?<Check/>:<Copy/>}Copy link</Button></div></div></SheetContent></Sheet>;
}
