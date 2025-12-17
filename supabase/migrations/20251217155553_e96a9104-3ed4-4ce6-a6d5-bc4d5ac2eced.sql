-- Make the music bucket public so audio files can be played via /storage/v1/object/public/music/*
update storage.buckets
set public = true
where id = 'music';