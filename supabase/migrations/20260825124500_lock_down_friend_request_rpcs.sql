REVOKE EXECUTE ON FUNCTION public.send_friend_request(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_friend_request(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_friend_request(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.respond_to_friend_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_friend_request(uuid, text) TO authenticated;
