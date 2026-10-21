import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Image as ImageIcon, MessageCircle, Share2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { canvasBlob, renderShareMoment, shareFilename } from "./canvas";
import { copyPng, copyText, downloadBlob, nativeShare, withReferral } from "./share";
import type { ShareFormat, ShareMoment, ReferralShareTemplate, ShareVisualLayout, ShareVisualTheme } from "./types";
import { loadCaptureImage } from "./avatarCapture";
import type { CharacterProfileShareMoment } from "./characterProfile";
import rockmundoLogo from "@/assets/rockmundo-new-logo.png";
import { saveShareMomentSnapshot } from "./gallery";
import { discardUploadedShareCard, storeTwaaterShareDraft, uploadShareCardToTwaater } from "./twaater";
import { useNavigate } from "react-router-dom";
import { trackShareAnalyticsEvent } from "./analytics";
import { markSharePromptSeen } from "./prompts";

export function ShareMomentSheet({moment,open,onOpenChange,avatarStatus,onAvatarRetry,onAvatarFallback,avatarWarning,onPromptAccepted}:{moment:ShareMoment|null;open:boolean;onOpenChange:(open:boolean)=>void;avatarStatus?:'loading'|'ready'|'unavailable';onAvatarRetry?:()=>void;onAvatarFallback?:()=>void;avatarWarning?:string;onPromptAccepted?:()=>void}){
 const {toast}=useToast(); const navigate=useNavigate();
 const [promptAccepted,setPromptAccepted]=useState(false);
 const promptOnly=Boolean(moment?.promptOnly);
 const sheetOpen=open&&(!promptOnly||promptAccepted);
 const canvasRef=useRef<HTMLCanvasElement|null>(null); const avatarRef=useRef<CanvasImageSource|null>(null); const artworkRef=useRef<CanvasImageSource|null>(null); const logoRef=useRef<CanvasImageSource|null>(null); const [format,setFormat]=useState<ShareFormat>("square"); const [done,setDone]=useState<string|null>(null); const [busy,setBusy]=useState<string|null>(null); const [status,setStatus]=useState(""); const [avatarVersion,setAvatarVersion]=useState(0); const [avatarDecodeFailed,setAvatarDecodeFailed]=useState(false); const [decodedAvatarUrl,setDecodedAvatarUrl]=useState<string|null>(null); const [decodedArtworkUrl,setDecodedArtworkUrl]=useState<string|null>(null); const [draft,setDraft]=useState<ShareMoment|null>(moment);
 const momentKey = moment ? `${moment.type}:${moment.id ?? moment.createdAt}` : '';
 const draftMatchesMoment = Boolean(moment && draft && draft.type===moment.type && draft.id===moment.id && draft.createdAt===moment.createdAt);
 useEffect(()=>{if(open&&moment){setDraft(previous => {
   // Avatar capture arrives after the sheet opens. Do not reset a player's
   // headline, style, layout or format when the snapshot finishes loading.
   if(previous?.type===moment.type && previous?.id===moment.id && previous?.createdAt===moment.createdAt) {
     return {...previous,avatar:(moment as CharacterProfileShareMoment).avatar ?? null};
   }
   return {...moment};
 });}},[sheetOpen,moment]);
 useEffect(()=>{if(sheetOpen)setFormat("square");},[sheetOpen,momentKey]);
 useEffect(()=>{setPromptAccepted(false);},[moment?.id,moment?.promptSourceId]);
 useEffect(()=>{
   if(open&&promptOnly&&moment){
     trackShareAnalyticsEvent("share_prompt_viewed",{momentType:moment.type,channel:"prompt"});
   }
 },[open,promptOnly,moment?.id]);
 useEffect(()=>{let cancelled=false;avatarRef.current=null;setDecodedAvatarUrl(null);setAvatarDecodeFailed(false);if(!sheetOpen||!moment?.avatar)return;const embedded=moment.avatar;
  void loadCaptureImage(embedded).then(avatar=>{if(!cancelled){avatarRef.current=avatar;setDecodedAvatarUrl(embedded.dataUrl);setAvatarVersion(v=>v+1)}}).catch(()=>{if(!cancelled){setAvatarDecodeFailed(true);setAvatarVersion(v=>v+1)}});
  return()=>{cancelled=true};
 },[sheetOpen,moment?.avatar?.dataUrl]);
 useEffect(()=>{let cancelled=false;artworkRef.current=null;setDecodedArtworkUrl(null);if(!sheetOpen||!moment?.artworkUrl){setAvatarVersion(v=>v+1);return;}const image=new Image();image.crossOrigin="anonymous";image.onload=()=>{if(!cancelled){artworkRef.current=image;setDecodedArtworkUrl(moment.artworkUrl);setAvatarVersion(v=>v+1)}};image.onerror=()=>{if(!cancelled)setAvatarVersion(v=>v+1)};image.src=moment.artworkUrl;return()=>{cancelled=true};},[sheetOpen,moment?.artworkUrl]);
 useEffect(()=>{let cancelled=false;const image=new Image();image.onload=()=>{if(!cancelled){logoRef.current=image;setAvatarVersion(v=>v+1)}};image.onerror=()=>{if(!cancelled)setAvatarVersion(v=>v+1)};image.src=rockmundoLogo;return()=>{cancelled=true};},[]);
 // Bind decoded media to the selected card. React effects may lag a card
 // switch, so never re-use the previous card's image for the next preview.
 const currentAvatar = moment?.avatar && decodedAvatarUrl===moment.avatar.dataUrl ? avatarRef.current : null;
 const currentArtwork = moment?.artworkUrl && decodedArtworkUrl===moment.artworkUrl ? artworkRef.current : null;
 useEffect(()=>{if(sheetOpen&&draft&&draftMatchesMoment&&canvasRef.current){renderShareMoment(canvasRef.current,draft,format,currentAvatar,currentArtwork,logoRef.current);trackShareAnalyticsEvent("share_rendered",{momentType:draft.type,format,template:draft.referralTemplate||draft.visualTheme||null,channel:"render"});}},[sheetOpen,draft,draftMatchesMoment,format,avatarVersion,currentAvatar,currentArtwork]);
 if(!moment||!draft)return null;
 if(open&&promptOnly&&!promptAccepted){
   return <div
     role="region"
     aria-label="Share this RockMundo moment"
     className="fixed left-4 right-4 top-20 z-[70] mx-auto max-w-sm rounded-xl border border-primary/40 bg-background/95 p-4 shadow-2xl backdrop-blur sm:left-auto sm:right-6 sm:top-24 sm:mx-0"
   >
     <div className="flex items-start gap-3">
       <div className="mt-0.5 rounded-full bg-primary/15 p-2 text-primary">
         <Share2 className="h-5 w-5"/>
       </div>
       <div className="min-w-0 flex-1">
         <p className="text-xs font-semibold uppercase tracking-wide text-primary">Shareable moment</p>
         <p className="mt-1 truncate text-sm font-semibold">{moment.headline}</p>
         {moment.subheadline&&<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{moment.subheadline}</p>}
         <div className="mt-3 flex flex-col gap-2 sm:flex-row">
           <Button
             type="button"
             size="sm"
             className="w-full shadow-md sm:w-auto"
             onClick={()=>{
               if(moment.promptKind&&moment.promptSourceId) markSharePromptSeen(moment.promptKind,moment.promptSourceId);
               setPromptAccepted(true);
               onPromptAccepted?.();
             }}
           >
             <Share2 className="h-4 w-4"/>
             {moment.promptLabel||"Share this moment"}
           </Button>
           <Button
             type="button"
             size="sm"
             variant="ghost"
             className="w-full sm:w-auto"
             onClick={()=>{
               if(moment.promptKind&&moment.promptSourceId) markSharePromptSeen(moment.promptKind,moment.promptSourceId);
               onOpenChange(false);
             }}
           >
             Not now
           </Button>
         </div>
       </div>
     </div>
   </div>;
 }
 const url=withReferral(draft.destinationUrl || "https://rockmundo.uk",draft.referralCode,draft.referralSource,draft.referralCampaign,draft.referralCreative); const text=[draft.headline,draft.subheadline].filter(Boolean).join(" — ");
 const applyReferralPreset=(preset:"short-video"|"feed"|"community")=>{if(preset==="short-video"){setFormat("story");setDraft({...draft,headline:"Start your music career",subheadline:"Create your character. Form a band. Play the world.",callToAction:"Join me on RockMundo",referralTemplate:"creator",visualTheme:"neon",visualLayout:"hero",referralCreative:"short_video"});}else if(preset==="feed"){setFormat("landscape");setDraft({...draft,headline:"Build your music career on RockMundo",subheadline:"Write songs, form a band, play gigs and grow your fame.",callToAction:"Start your career",referralTemplate:"world-tour",visualTheme:"spotlight",visualLayout:"right",referralCreative:"feed"});}else{setFormat("square");setDraft({...draft,headline:"Join our RockMundo community",subheadline:"Create a musician, meet players and build a band together.",callToAction:"Join the community",referralTemplate:"backstage",visualTheme:"moment",visualLayout:"right",referralCreative:"community"});}};
 const duplicateVariant=()=>{const variants=[{headline:"Think you can make it in music?",subheadline:"Start from nothing, build your skills and take your band around the world.",callToAction:"Prove it on RockMundo"},{headline:"Your music career starts here",subheadline:"Create your character, write songs, recruit a band and chase the charts.",callToAction:"Start playing"},{headline:"Form a band. Build a legacy.",subheadline:"Join RockMundo and turn your character into a global music star.",callToAction:"Join RockMundo"}];const current=variants.findIndex(v=>v.headline===draft.headline);const nextIndex=(current+1)%variants.length;const next=variants[nextIndex];const base=(draft.referralCreative||"custom").replace(/_hook[1-3]$/,"");setDraft({...draft,...next,referralCreative:`${base}_hook${nextIndex+1}`});toast({title:"Creative variant generated",description:"Attribution stays on the same referral campaign."});};
 const avatarCapable=["character_profile","gig_result","achievement","tour"].includes(draft.type);
 // Even a historical snapshot opened through the generic sheet must finish
 // decoding before its avatar can be included in any exported image.
 // Compare the decoded URL to the current card so fast gallery switches
 // cannot accidentally export the previous character's portrait.
 const avatarPreparing=avatarStatus==='loading'||!draftMatchesMoment||(!!moment.avatar&&(decodedAvatarUrl!==moment.avatar.dataUrl||!avatarRef.current)&&!avatarDecodeFailed);
 const avatarFailed=avatarStatus==='unavailable'||avatarDecodeFailed;
 // An avatar-aware share must never produce a characterless image when
 // capture or decoding fails. Text links remain shareable independently.
 const avatarExportBlocked=avatarPreparing||(avatarFailed&&(avatarStatus!==undefined||!!moment.avatar));
 const blob=()=>{
   if(avatarExportBlocked) return Promise.reject(new Error(avatarPreparing ? "Avatar image is still being prepared" : "Avatar could not be rendered. Retry before exporting the image"));
   if(!canvasRef.current) return Promise.reject(new Error("Preview unavailable"));
   // The canvas preview redraw is effect-driven. Export must synchronously
   // render the latest selected card and format before reading PNG pixels.
   renderShareMoment(canvasRef.current,draft,format,currentAvatar,currentArtwork,logoRef.current);
   return canvasBlob(canvasRef.current);
 };
 const avatarMissing=(avatarCapable||avatarStatus!==undefined)&&(!draft.avatar||avatarDecodeFailed);
 // Copy link remains usable during a failed avatar render. Do not let this
 // text-only action upsert a snapshot with avatar:null over an older, valid
 // frozen portrait. Public/no-avatar cards continue saving as before.
 const snapshotExpectsAvatar=avatarStatus!==undefined||!!moment.avatar;
 const snapshotHasCurrentAvatar=!!moment.avatar&&draft.avatar?.dataUrl===moment.avatar.dataUrl
   &&decodedAvatarUrl===moment.avatar.dataUrl&&!avatarExportBlocked;
 const saveGallerySnapshot=draftMatchesMoment&&(!snapshotExpectsAvatar||snapshotHasCurrentAvatar);
 const recordShare=()=>{try{if(draft.shareCooldownKey&&typeof localStorage!=="undefined")localStorage.setItem(draft.shareCooldownKey,String(Date.now()));}catch{/* Browser storage is optional. */}
   if (!saveGallerySnapshot) return;
   void saveShareMomentSnapshot(draft).catch((error)=>toast({title:"Share not saved to gallery",description:error instanceof Error?error.message:"Try again from Share Studio",variant:"destructive"}))
 }; const flash=(k:string)=>{setDone(k);setTimeout(()=>setDone(v=>v===k?null:v),1400)};
 const postToTwaater=async()=>{setBusy("twaater");setStatus("Preparing Twaater post");let mediaUrl:string|null=null;try{const b=await blob();mediaUrl=await uploadShareCardToTwaater(b,shareFilename(draft,format));await storeTwaaterShareDraft([text,url].filter(Boolean).join("\n"),mediaUrl,draft.shareCooldownKey);onOpenChange(false);navigate("/twaater");}catch(e){if(mediaUrl){try{await discardUploadedShareCard?.(mediaUrl)}catch(cleanupError){console.warn("Unable to clean up failed share card upload",cleanupError)}}toast({title:"Unable to prepare Twaater post",description:(e as Error).message,variant:"destructive"});setStatus("Unable to prepare Twaater post")}finally{setBusy(null)}};
 const share=async()=>{setBusy("share");setStatus("Preparing share");trackShareAnalyticsEvent("share_native_started",{momentType:draft.type,format,template:draft.referralTemplate||draft.visualTheme||null,channel:"native"});try{const b=await blob();const file=new File([b],shareFilename(draft,format),{type:"image/png"});const result=await nativeShare({title:draft.headline,text,url,file});if(result==="unsupported"){(await copyText([text,url].filter(Boolean).join("\n")))?(recordShare(),toast({title:"Share link copied"})):toast({title:"Sharing unsupported",description:"Download the PNG to share it manually.",variant:"destructive"});}else if(result==="shared"){recordShare();flash("share");setStatus("Share completed")}}catch(e){toast({title:"Unable to share",description:(e as Error).message,variant:"destructive"});setStatus("Unable to share")}finally{setBusy(null)}};
 return <Sheet open={sheetOpen} onOpenChange={onOpenChange}><SheetContent side="right" className="w-full max-w-full overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-lg"><SheetHeader><SheetTitle className="flex items-center gap-2"><Share2 className="h-4 w-4"/>Share your RockMundo moment</SheetTitle><SheetDescription>Choose a format, preview the branded card, then share the image or link.</SheetDescription></SheetHeader><div className="mt-4 space-y-4"><div role="group" aria-label="Share image format" className="flex flex-wrap gap-2">{(["square","story","landscape"] as ShareFormat[]).map(f=><Button key={f} type="button" size="sm" aria-pressed={format===f} variant={format===f?"default":"outline"} onClick={()=>setFormat(f)} className="capitalize">{f}</Button>)}</div><div className="space-y-3 rounded-lg border p-3"><div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Style</p><div className="flex flex-wrap gap-2">{(["moment","spotlight","neon","mono"] as ShareVisualTheme[]).map(theme=><Button key={theme} type="button" size="sm" variant={(draft.visualTheme||"moment")===theme?"default":"outline"} className="capitalize" onClick={()=>setDraft({...draft,visualTheme:theme})}>{theme==="moment"?"Original":theme}</Button>)}</div></div><div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Layout</p><div className="flex flex-wrap gap-2">{(["right","hero","left"] as ShareVisualLayout[]).map(layout=><Button key={layout} type="button" size="sm" variant={(draft.visualLayout||"right")===layout?"default":"outline"} className="capitalize" onClick={()=>setDraft({...draft,visualLayout:layout})}>{layout==="right"?"Visual right":layout==="left"?"Visual left":"Hero"}</Button>)}</div></div>{draft.type==="referral"&&<div className="space-y-3"><div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Channel preset</p><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={()=>applyReferralPreset("short-video")}>TikTok / Reels</Button><Button type="button" size="sm" variant="outline" onClick={()=>applyReferralPreset("feed")}>Facebook / X</Button><Button type="button" size="sm" variant="outline" onClick={()=>applyReferralPreset("community")}>Discord / Community</Button></div></div><div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Campaign template</p><div className="flex flex-wrap gap-2">{(["creator","backstage","world-tour"] as ReferralShareTemplate[]).map(template=><Button key={template} type="button" size="sm" variant={(draft.referralTemplate||"creator")===template?"default":"outline"} className="capitalize" onClick={()=>setDraft({...draft,referralTemplate:template})}>{template==="world-tour"?"World tour":template}</Button>)}</div></div><Button type="button" size="sm" variant="secondary" onClick={duplicateVariant}>Generate A/B copy variant</Button></div>}<div className="grid gap-2"><Input value={draft.headline} maxLength={80} aria-label="Share headline" onChange={e=>setDraft({...draft,headline:e.target.value})}/><Input value={draft.subheadline||""} maxLength={120} placeholder="Optional subheadline" aria-label="Share subheadline" onChange={e=>setDraft({...draft,subheadline:e.target.value})}/>{draft.type==="referral"&&<Input value={draft.callToAction||""} maxLength={42} placeholder="Call to action, e.g. Join my RockMundo crew" aria-label="Share call to action" onChange={e=>setDraft({...draft,callToAction:e.target.value})}/>}</div></div><div className="rounded-lg border bg-muted/30 p-2"><canvas ref={canvasRef} className="h-auto w-full rounded-md" role="img" aria-label={`RockMundo ${format} share card preview for ${draft.headline}`}/>{avatarPreparing&&<p role="status" className="mt-2 text-xs text-muted-foreground">Rendering your player avatar for the image…</p>}
 {avatarFailed&&<div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-xs text-destructive"><span>Your avatar could not be rendered. Image export is paused until it is ready.</span>{onAvatarRetry&&<Button type="button" size="sm" variant="outline" onClick={onAvatarRetry}>Retry avatar</Button>}{onAvatarFallback&&<Button type="button" size="sm" variant="outline" onClick={onAvatarFallback}>Continue without crafted instrument</Button>}</div>}
 {avatarWarning&&<p role="status" className="mt-2 text-xs text-amber-500">{avatarWarning}</p>}
 {avatarMissing&&!avatarPreparing&&!avatarFailed&&<p className="mt-2 text-xs text-muted-foreground">Avatar preview unavailable. The branded card can still be shared.</p>}</div><p className="sr-only" aria-live="polite">{status}</p><div className="sticky bottom-0 -mx-6 grid grid-cols-1 gap-2 border-t bg-background/95 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:grid-cols-2"><Button type="button" className="sm:col-span-2" disabled={!!busy||avatarExportBlocked} aria-busy={busy==="share"} onClick={share}>{done==="share"?<Check/>:<Share2/>}Share now</Button><Button type="button" className="sm:col-span-2" variant="secondary" disabled={!!busy||avatarExportBlocked} aria-busy={busy==="twaater"} onClick={postToTwaater}><MessageCircle/>Post to Twaater</Button><Button type="button" variant="secondary" disabled={!!busy||avatarExportBlocked} onClick={async()=>{setBusy("download");try{const b=await blob();downloadBlob(b,shareFilename(draft,format));recordShare();trackShareAnalyticsEvent("share_downloaded",{momentType:draft.type,format,template:draft.referralTemplate||draft.visualTheme||null,channel:"download"});flash("download");setStatus("PNG downloaded")}catch(e){toast({title:"Unable to download image",description:(e as Error).message,variant:"destructive"})}finally{setBusy(null)}}}>{done==="download"?<Check/>:<Download/>}Download PNG</Button><Button type="button" variant="outline" disabled={!!busy||avatarExportBlocked} onClick={async()=>{setBusy("image");try{const b=await blob();if(await copyPng(b)){recordShare();flash("image");setStatus("Image copied")}else toast({title:"Copy image unsupported",description:"Download the PNG instead.",variant:"destructive"})}catch(e){toast({title:"Unable to copy image",description:(e as Error).message,variant:"destructive"})}finally{setBusy(null)}}}>{done==="image"?<Check/>:<ImageIcon/>}Copy image</Button><Button type="button" variant="outline" disabled={!!busy||!draftMatchesMoment} onClick={async()=>{setBusy("link");try{if(!url?.trim()){toast({title:"No share link available",description:"This card has no destination URL to copy.",variant:"destructive"});return;}if(await copyText([text,url].filter(Boolean).join("\n"))){recordShare();trackShareAnalyticsEvent("share_link_copied",{momentType:draft.type,format,template:draft.referralTemplate||draft.visualTheme||null,channel:"copy_link"});flash("link");setStatus("Share link copied")}else toast({title:"Copy link unavailable",description:"Your browser blocked clipboard access.",variant:"destructive"})}finally{setBusy(null)}}}>{done==="link"?<Check/>:<Copy/>}Copy link</Button></div></div></SheetContent></Sheet>;
}
