DROP POLICY IF EXISTS "Streaming accounts are viewable by everyone" ON public.player_streaming_accounts;

CREATE POLICY "Users can view their streaming accounts"
ON public.player_streaming_accounts
FOR SELECT
USING (auth.uid() = user_id);
