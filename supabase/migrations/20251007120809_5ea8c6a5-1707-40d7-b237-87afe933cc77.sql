-- Add missing quality columns to songs table
ALTER TABLE songs ADD COLUMN IF NOT EXISTS melody_strength integer;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS lyrics_strength integer;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS rhythm_strength integer;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS arrangement_strength integer;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS production_potential integer;

-- Add cascade delete for songwriting_sessions
ALTER TABLE songwriting_sessions
DROP CONSTRAINT IF EXISTS songwriting_sessions_project_id_fkey,
ADD CONSTRAINT songwriting_sessions_project_id_fkey
FOREIGN KEY (project_id) REFERENCES songwriting_projects(id)
ON DELETE CASCADE;

-- Ensure RLS policy for deleting projects exists
DROP POLICY IF EXISTS "Users can delete their own projects" ON songwriting_projects;
CREATE POLICY "Users can delete their own projects"
ON songwriting_projects FOR DELETE
USING (auth.uid() = user_id);