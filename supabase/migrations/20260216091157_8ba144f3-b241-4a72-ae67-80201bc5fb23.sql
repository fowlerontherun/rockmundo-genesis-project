-- Restore original user lyrics and fix status for "Girls don't buy rounds"
UPDATE public.songs 
SET 
  lyrics = '[verse 1]
I''ve never seen them at the bar
I''ve seen them from a far
They never get them in
 Is it even a thing 

[Chorus]
Girls don''t get rounds
Girls don''t do rounds
The men get them In
Girls 
dont buy
rounds',
  audio_generation_status = 'completed',
  audio_prompt = 'Style: Punk Rock , blink 182 style vocal song

Lyrics:
[verse 1]
I''ve never seen them at the bar
I''ve seen them from a far
They never get them in
 Is it even a thing 

[Chorus]
Girls don''t get rounds
Girls don''t do rounds
The men get them In
Girls 
dont buy
rounds'
WHERE id = 'ed4d2171-e4bf-4aee-9376-bc6420f81dd7';