-- This is a trigger-only SECURITY DEFINER helper. It must not be exposed as an
-- RPC-capable function to API roles.
REVOKE ALL ON FUNCTION public.prevent_private_auth_contact_as_public_profile_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_private_auth_contact_as_public_profile_identity() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_private_auth_contact_as_public_profile_identity() FROM authenticated;
