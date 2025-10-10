-- Add DELETE policy for avatar uploads
-- This allows users to delete their old avatars when uploading new ones
CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);