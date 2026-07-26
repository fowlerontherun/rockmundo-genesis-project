import { supabase } from "@/integrations/supabase/client";
import { festivalAwardSchema, festivalHallOfFameSchema, festivalRecordSchema, festivalResultDetailSchema, festivalResultPageSchema, festivalStatisticsSchema, parseLegacyPayload } from "./parsers";
import type { FestivalLegacyFilter } from "./types";
import { z } from "zod";

const call=async(name:string,args:Record<string,unknown>,schema:z.ZodTypeAny)=>{const {data,error}=await supabase.rpc(name as never,args as never);if(error)throw error;return parseLegacyPayload(schema,data);};
const filterArgs=(f:FestivalLegacyFilter)=>({p_year:f.year??null,p_country:f.country??null,p_city:f.city??null,p_festival_type:f.festivalType??null,p_genre:f.genre??null,p_limit:f.limit??24,p_offset:f.offset??0});
export const festivalLegacyWorkerRpcs=["generate_festival_result","refresh_festival_world_records","generate_festival_season_awards","process_festival_legacy_generation_jobs","process_festival_legacy_publications"] as const;
export const festivalLegacyService={
 results:(f:FestivalLegacyFilter)=>call("get_festival_results",filterArgs(f),festivalResultPageSchema),history:(f:FestivalLegacyFilter)=>call("get_festival_history",filterArgs(f),festivalResultPageSchema),
 detail:(id:string)=>call("get_festival_result_detail",{p_result_id:id},festivalResultDetailSchema.nullable()),awards:(year?:number)=>call("get_festival_awards",{p_year:year??null},z.array(festivalAwardSchema)),records:()=>call("get_festival_records",{},z.array(festivalRecordSchema)),
 statistics:(f:FestivalLegacyFilter,groupBy="festival")=>call("get_festival_statistics",{...filterArgs(f),p_group_by:groupBy},festivalStatisticsSchema),hallOfFame:()=>call("get_festival_hall_of_fame",{},festivalHallOfFameSchema)
};
