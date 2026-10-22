import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { ChefHat, RotateCcw, Utensils } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { CookingEquipmentScene, CookingStageGuide } from "./CookingEquipmentScene";
import { IngredientIllustration, DishIllustration } from "./CookingIllustrations";
import { projectLiveTechnique, type LiveTechniqueMethod, type TechniqueServerAction } from "./liveTechniqueProjection";

interface Recipe { slug:string; name:string; method:LiveTechniqueMethod; portions:number }
interface Session { id:string; recipe_slug:string; status:string; started_at:string;
  expires_at:string; execution_score:number|null }
interface Snapshot { session:Session; actions:TechniqueServerAction[]; serverNow?:string }
type Action = "start"|"status"|"add"|"heat"|"remove"|"stir"|"serve"|"finish";
type Request = { action:Action; sessionId:string; profileId:string; recipeSlug?:string;
  ingredientSlug?:string; heat?:string };
const nice=(slug:string)=>slug.replace(/[-_]/g," ").replace(/\b\w/g,v=>v.toUpperCase());
async function callGateway<T>(body:Request):Promise<T>{
  const {data,error}=await supabase.functions.invoke<T>("cooking-session",{body});
  if(error)throw new Error(error.message||"Cooking service unavailable");
  const reply=data as {error?:string;detail?:string}|null;
  if(reply?.error)throw new Error(reply.detail||reply.error);
  if(!data)throw new Error("Cooking server did not confirm action");
  return data as T;
}
function Ingredient({slug,onSelect,selected,disabled}:{
  slug:string;onSelect:()=>void;selected:boolean;disabled:boolean;
}){
  const {setNodeRef,attributes,listeners,transform,isDragging}=useDraggable({
    id:"technique:"+slug,disabled,
  });
  return <button type="button" ref={setNodeRef} {...attributes} {...listeners}
    onClick={onSelect} disabled={disabled} aria-pressed={selected}
    aria-label={"Select "+nice(slug)}
    className={"cooking-ingredient "+(selected?"cooking-selected":"")}
    style={{opacity:isDragging ? 0.35 : 1,transform:transform
      ?"translate3d("+transform.x+"px,"+transform.y+"px,0)":undefined}}>
    <IngredientIllustration slug={slug}/>
    <span className="text-xs">{nice(slug)}</span>
  </button>;
}
function Workstation({method,recipeSlug,stage,heating,added,stirs}:{
  method:LiveTechniqueMethod;recipeSlug:string;
  stage:ReturnType<typeof projectLiveTechnique>["stage"];
  heating:boolean;added:boolean;stirs:number;
}){
  const {setNodeRef,isOver}=useDroppable({id:"technique-workstation"});
  return <section ref={setNodeRef} aria-label="Live cooking workstation"
    className={"rounded-xl border-2 p-3 "+(isOver?"cooking-over":"")}>
    <CookingEquipmentScene method={method} recipeSlug={recipeSlug} stage={stage}
      heating={heating} hasIngredients={added} stirring={method==="mix"&&stirs>0}/>
    <p className="mt-2 text-center text-sm font-medium">{nice(method)} · {stage}</p>
  </section>;
}

/** Non-pan live cooking is locked behind active server recipes, never local scores. */
export function CookingLiveTechniques(){
  const {profileId}=useActiveProfile();
  return <TechniquesForProfile key={profileId??"none"} profileId={profileId}/>;
}
function TechniquesForProfile({profileId}:{profileId:string|null}){
  const qc=useQueryClient();
  const [slug,setSlug]=useState("");
  const [sessionId,setSessionId]=useState<string|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [now,setNow]=useState(()=>Date.now());
  const startKey=useRef<string|null>(null);
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}));

  const recipes=useQuery({
    queryKey:["cooking-live-technique-recipes"],
    queryFn:async()=>{
      const {data,error}=await (supabase as any).from("cooking_recipes")
        .select("slug,name,method,portions").eq("is_active",true)
        .in("method",["oven","simmer","mix"]).order("name");
      if(error)throw error;
      return (data??[]) as Recipe[];
    },staleTime:30_000,
  });
  const available=recipes.data??[];
  const selectedRecipe=available.find(r=>r.slug===slug)??available[0];
  const active=useQuery({
    queryKey:["cooking-techniques-active-session",profileId],enabled:Boolean(profileId),
    queryFn:async()=>{
      const {data,error}=await (supabase as any).from("cooking_sessions")
        .select("id,recipe_slug").eq("profile_id",profileId)
        .in("status",["pending","running"])
        .order("started_at",{ascending:false}).limit(1).maybeSingle();
      if(error)throw error;
      return data as {id:string;recipe_slug:string}|null;
    },refetchOnMount:"always",
  });
  useEffect(()=>{
    if(!sessionId&&active.data&&available.some(r=>r.slug===active.data.recipe_slug)){
      setSessionId(active.data.id);
    }
  },[sessionId,active.data,available]);
  const snapshot=useQuery({
    queryKey:["cooking-session-snapshot",sessionId],
    enabled:Boolean(profileId&&sessionId),
    queryFn:()=>callGateway<Snapshot>({action:"status",sessionId:sessionId!,profileId:profileId!}),
    refetchInterval:q=>{
      const state=q.state.data?.session.status;
      return !state||["pending","running"].includes(state)?1700:false;
    },refetchOnWindowFocus:true,
  });
  const session=snapshot.data?.session;
  const recipe=available.find(r=>r.slug===session?.recipe_slug)??selectedRecipe;
  const ingredientSlug=session?.recipe_slug??recipe?.slug??"";
  const ingredients=useQuery({
    queryKey:["cooking-technique-recipe-parts",ingredientSlug],
    enabled:Boolean(ingredientSlug),
    queryFn:async()=>{
      const {data,error}=await (supabase as any).from("cooking_recipe_ingredients")
        .select("ingredient_slug").eq("recipe_slug",ingredientSlug)
        .order("ingredient_slug");
      if(error)throw error;
      return (data??[]).map((row:{ingredient_slug:string})=>row.ingredient_slug) as string[];
    },staleTime:30_000,
  });
  const running=Boolean(session&&["pending","running"].includes(session.status));
  useEffect(()=>{
    if(!running)return;
    const handle=window.setInterval(()=>setNow(Date.now()),250);
    return ()=>window.clearInterval(handle);
  },[running]);
  const anchor=Date.parse(snapshot.data?.serverNow??"");
  const wall=Number.isFinite(anchor)
    ?anchor+Math.max(0,now-snapshot.dataUpdatedAt):now;
  const view=session&&recipe&&ingredients.data
    ?projectLiveTechnique(recipe.method,ingredients.data,snapshot.data?.actions??[],
      session.started_at,session.expires_at,wall,running):null;
  const remaining=(ingredients.data??[]).filter(i=>!view?.loaded.includes(i));
  const plated=(ingredients.data??[]).filter(i=>view?.loaded.includes(i)&&!view?.served.includes(i));
  const fullyLoaded=Boolean(ingredients.data?.length&&view&&
    view.loaded.length===ingredients.data.length);
  const canAct=Boolean(profileId&&sessionId&&running&&!snapshot.isError);
  const mutation=useMutation({
    mutationFn:async(request:Request)=>({request,reply:await callGateway<{sessionId?:string}>(request)}),
    onSuccess:({request,reply})=>{
      if(request.action==="start"){
        setSessionId(reply.sessionId??request.sessionId);
        startKey.current=null;
      }
      setNotice(null);
      void Promise.all([
        qc.invalidateQueries({queryKey:["cooking-session-snapshot",request.sessionId]}),
        qc.invalidateQueries({queryKey:["cooking-active-session",profileId]}),
        qc.invalidateQueries({queryKey:["cooking-techniques-active-session",profileId]}),
        qc.invalidateQueries({queryKey:["cooking-inventory",profileId]}),
      ]);
    },
    onError:(error:Error)=>setNotice(error.message),
  });
  const send=(action:Action,fields:Partial<Request>={})=>{
    if(!profileId||!sessionId)return;
    mutation.mutate({action,sessionId,profileId,...fields});
  };
  const start=()=>{
    if(!profileId||!selectedRecipe)return;
    if(!startKey.current)startKey.current=crypto.randomUUID();
    mutation.mutate({action:"start",profileId,sessionId:startKey.current,
      recipeSlug:selectedRecipe.slug});
  };
  const panBusy=Boolean(active.data&&!available.some(r=>r.slug===active.data?.recipe_slug));
  const method=recipe?.method??"oven";
  const stage=view?.stage??(method==="mix"?"Unmixed":"Raw");
  const busy=mutation.isPending;

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <ChefHat className="h-5 w-5"/>Live baking, soups and drinks
      </CardTitle>
      <CardDescription>
        Server-certified cooking when recipes are enabled: every ingredient, heat
        change and stir is recorded before a batch can earn food or boosts.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {!profileId&&<p role="status">Select your character to cook.</p>}
      {recipes.isLoading&&<p role="status">Checking enabled baking, soup and drink recipes…</p>}
      {recipes.isError&&<p role="alert">Unable to load enabled recipe methods.</p>}
      {!recipes.isLoading&&!available.length&&<div className="flex items-center gap-3 rounded-lg border p-3">
        <DishIllustration recipeSlug="apple-pie" className="h-24 w-36 rounded-lg"/>
        <p role="status" className="text-sm">
          Live baking, soups and drinks are not released yet. The illustrated
          free techniques workshop below is available without spending ingredients.
        </p>
      </div>}
      {panBusy&&<p role="status">Finish your current pan session before starting another method.</p>}
      {Boolean(profileId&&available.length&&!sessionId)&&<div className="space-y-3">
        <label htmlFor="cooking-live-technique-recipe" className="block text-sm font-medium">
          Choose a recipe
          <select id="cooking-live-technique-recipe"
            className="mt-1 block w-full rounded-md border bg-background p-2"
            value={selectedRecipe?.slug??""} onChange={e=>setSlug(e.target.value)}>
            {available.map(r=><option key={r.slug} value={r.slug}>
              {r.name} · {r.method} · {r.portions} portions
            </option>)}
          </select>
        </label>
        {selectedRecipe&&<div className="flex flex-wrap items-center gap-3 rounded-lg border p-2">
          <DishIllustration recipeSlug={selectedRecipe.slug} className="h-24 w-36 rounded-lg"/>
          <p className="text-sm">Starting consumes fresh ingredients, even if the
            attempt is burned or abandoned. Server scoring is authoritative.</p>
        </div>}
        <Button disabled={!profileId||panBusy||busy} onClick={start}>Start cooking</Button>
      </div>}
      {sessionId&&!session&&!snapshot.isError&&<p role="status">Restoring saved kitchen session…</p>}
      {snapshot.isError&&<p role="alert">Session could not be restored. Try syncing.</p>}
      {session&&<div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <strong>{nice(session.recipe_slug)}</strong>
          <span className="text-sm">{session.status}</span>
          {view&&<span className="text-sm tabular-nums">
            {running?view.deadlineSeconds+" seconds remaining":"Session ended"}
          </span>}
          <Button size="sm" variant="outline" disabled={snapshot.isFetching}
            onClick={()=>void snapshot.refetch()}>
            <RotateCcw className="mr-2 h-4 w-4"/>Sync
          </Button>
        </div>
        {session.status==="completed"&&<div className="flex items-center gap-3 rounded-lg border p-2">
          <DishIllustration recipeSlug={session.recipe_slug} className="h-24 w-36 rounded-lg"/>
          <p role="status">Cooked food saved to your inventory.
            Server score: {session.execution_score}/100.</p>
        </div>}
        {session.status==="failed"&&<p role="status">
          Food spoiled. Ingredients were consumed and no food was awarded.</p>}
        {session.status==="timed_out"&&<p role="status">
          Cooking session expired and cannot be resumed.</p>}
        {!running&&<Button variant="outline" onClick={()=>{
          setSessionId(null);setSelected(null);startKey.current=null;
          void qc.invalidateQueries({queryKey:["cooking-techniques-active-session",profileId]});
        }}>Return to recipe selection</Button>}
        {view&&recipe&&<DndContext sensors={sensors}
          onDragEnd={({active:drag,over})=>{
            if(over?.id!=="technique-workstation"||!canAct||busy)return;
            const item=String(drag.id).replace(/^technique:/,"");
            if(remaining.includes(item))send("add",{ingredientSlug:item});
          }}>
          <div className="grid gap-3 lg:grid-cols-2">
            <section aria-label="Reserved ingredient tray" className="cooking-zone cooking-tray">
              <h4 className="mb-2 font-semibold">Reserved ingredients</h4>
              <div className="cooking-zone-items">
                {remaining.map(item=><Ingredient key={item} slug={item}
                  selected={selected===item} onSelect={()=>setSelected(item)}
                  disabled={!canAct||busy}/>)}
              </div>
              <Button variant="secondary" className="mt-3 w-full"
                disabled={!canAct||busy||!selected||!remaining.includes(selected)}
                onClick={()=>selected&&send("add",{ingredientSlug:selected})}>
                Add selected to {method==="oven"?"baking tray":method==="simmer"?"pot":"mixing jug"}
              </Button>
            </section>
            <Workstation method={method} recipeSlug={recipe.slug} stage={stage}
              added={view.loaded.length>0} stirs={view.stirs}
              heating={running&&view.heat!=="off"}/>
          </div>
        </DndContext>}
        {view&&method!=="mix"&&<CookingStageGuide stage={stage}/>}
        {view&&<p role="status" className="text-sm">
          Loaded {view.loaded.length}/{ingredients.data?.length??0} ·
          Served {view.served.length}/{ingredients.data?.length??0} ·
          {method==="mix"?" Stirs "+view.stirs+"/5":
            " Heat exposure "+view.exposure.toFixed(1)+" seconds"}
        </p>}
        {view&&method!=="mix"&&<fieldset disabled={!canAct||busy}>
          <legend className="text-sm font-semibold">Adjust heat</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["off","low","medium","high"] as const).map(heat=><label key={heat}
              className={"cooking-heat "+(view.heat===heat?"cooking-selected":"")}>
              <input type="radio" name="live-technique-heat" checked={view.heat===heat}
                disabled={!fullyLoaded||view.served.length>0}
                onChange={()=>send("heat",{heat})}/>{nice(heat)}
            </label>)}
          </div>
        </fieldset>}
        {view&&method==="mix"&&<Button
          disabled={!canAct||busy||!fullyLoaded||view.stirs>=8||view.served.length>0}
          onClick={()=>send("stir")}>Stir drink ({view.stirs}/5)</Button>}
        {view&&<div className="flex flex-wrap gap-2">
          <Button variant="outline"
            disabled={!canAct||busy||!fullyLoaded||!plated.length||
              (method==="mix"?view.stirs<3:view.exposure===0)}
            onClick={()=>send("serve")}>
            <Utensils className="mr-2 h-4 w-4"/>Plate all ingredients
          </Button>
          <Button disabled={!canAct||busy||!fullyLoaded||
            view.served.length!==ingredients.data?.length}
            onClick={()=>send("finish")}>Finish and save food</Button>
        </div>}
      </div>}
      {busy&&<p role="status">Confirming server cooking actions…</p>}
      {notice&&<p role="alert" className="text-sm">{notice}</p>}
    </CardContent>
  </Card>;
}
