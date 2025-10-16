-- Create admin song gifts log table
CREATE TABLE IF NOT EXISTS admin_song_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid REFERENCES songs(id) ON DELETE SET NULL,
  gifted_to_band_id uuid REFERENCES bands(id) ON DELETE SET NULL,
  gifted_to_user_id uuid,
  gifted_by_admin_id uuid NOT NULL,
  gift_message text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on admin_song_gifts
ALTER TABLE admin_song_gifts ENABLE ROW LEVEL SECURITY;

-- Admin can view and create gift logs
CREATE POLICY "Admins can view gift logs"
ON admin_song_gifts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create gift logs"
ON admin_song_gifts
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND gifted_by_admin_id = auth.uid());