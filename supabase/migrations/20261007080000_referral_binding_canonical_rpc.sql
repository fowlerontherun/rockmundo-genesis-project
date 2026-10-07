-- Retire the legacy one-argument referral binder now all callers use the source-aware RPC.
revoke all on function public.bind_referral_code(text) from public, anon, authenticated;
drop function public.bind_referral_code(text);

-- Reassert the intended API ACL on the canonical overload.
revoke all on function public.bind_referral_code(text,text) from public, anon, authenticated;
grant execute on function public.bind_referral_code(text,text) to authenticated;