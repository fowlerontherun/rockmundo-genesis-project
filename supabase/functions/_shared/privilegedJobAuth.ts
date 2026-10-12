import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * Privileged settlement jobs are public-facing edge functions when verify_jwt=false.
 * Authorize before constructing a service-role client or writing any state.
 * Cron must send a service-role bearer token or x-cron-secret matching the env secret.
 */
export async function authorizePrivilegedJob(req: Request): Promise<Response | null> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!key || !url) return new Response(JSON.stringify({error:"Server authorization unavailable"}), {status:503});
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  const cronSecret = Deno.env.get("ROCKMUNDO_CRON_SECRET");
  if (token && token === key) return null;
  if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) return null;
  if (!token) return new Response(JSON.stringify({error:"Privileged authentication required"}), {status:401});
  const service = createClient(url,key);
  const {data:{user},error} = await service.auth.getUser(token);
  if (error || !user) return new Response(JSON.stringify({error:"Invalid authentication"}), {status:401});
  const {data:role,error:roleError} = await service.rpc("get_user_role",{_user_id:user.id});
  if (roleError || role!=="admin") return new Response(JSON.stringify({error:"Admin access required"}), {status:403});
  return null;
}
