

# v1.0.720 — Fix Song Lyrics Overwrite and Generation Recovery

## Problem Summary

Three interrelated issues with AI song generation:

1. **User lyrics being overwritten**: The user's original punk lyrics for "Girls don't buy rounds" were replaced by AI-generated lyrics in the database. The current lyrics prioritization logic has gaps that allow this.

2. **Duplicate lyrics in prompt**: The `audio_prompt` shows TWO "Lyrics:" sections concatenated -- the user's originals followed by AI-generated lyrics. The sanitizer isn't fully catching this.

3. **Song stuck in "failed" status**: The song already has a working `audio_url` from a successful Feb 13 generation, but its status was set to "failed" during a later regen attempt that errored out.

## Plan

### 1. Fix the lyrics source in the songs table (Data Fix)

The song `ed4d2171-e4bf-4aee-9376-bc6420f81dd7` needs its status corrected:
- It already has a valid `audio_url` -- set `audio_generation_status` back to `completed`
- The `songs.lyrics` field currently holds AI-generated content; the user's original lyrics exist only in the `audio_prompt` field

We'll run a SQL update to fix this specific song's status. The user's original lyrics will need to be manually restored or the user can re-enter them.

### 2. Strengthen lyrics protection in `generate-song-audio`

**Problem**: The `hadOriginalLyrics` guard (line 294) only prevents saving when the song/project already had lyrics. But it doesn't prevent the AI-generated lyrics from being used as `rawLyrics` if a previous run already overwrote the field.

**Fix**:
- Add a check: if `rawLyrics` was sourced from `song.lyrics` but the song already has a completed `audio_url`, skip AI lyrics generation entirely (the song was already generated once)
- Strengthen `sanitizeLyrics` to also detect the `(You)` / `(Me)` singer markers in AI-generated lyrics as a contamination signal
- Never save AI-generated lyrics to `songs.lyrics` if the song already has an `audio_url`

### 3. Improve the `sanitizeLyrics` duplicate detection

**Problem**: The function splits on `\n\s*Lyrics:\s*\n` but the concatenation pattern in the stored data may not match this exact whitespace pattern.

**Fix**:
- Make the `Lyrics:` split regex more flexible to catch variations
- Also detect when user lyrics and AI lyrics are concatenated without a `Lyrics:` separator (by checking for dramatically different writing styles via duplicate section markers like two `[Verse 1]` blocks)

### 4. Prevent regeneration when audio already exists

**Problem**: Line 48 only blocks if status is `completed` AND `audio_url` exists. If status got corrupted to `failed` but audio exists, it allows regen.

**Fix**:
- If a song already has a valid `audio_url`, block regeneration regardless of status (or at least warn), unless explicitly requested by admin override
- Add a "recovery" path: if status is `failed` but `audio_url` exists, automatically fix the status to `completed` instead of allowing a new generation

### 5. Version bump

Update `VersionHeader.tsx`, `navigation.tsx`, and `VersionHistory.tsx` to v1.0.720.

## Technical Details

### Files to modify:
- `supabase/functions/generate-song-audio/index.ts` -- lyrics protection, sanitizer improvements, audio_url guard
- `supabase/functions/admin-generate-song-audio/index.ts` -- same sanitizer improvements
- `src/components/VersionHeader.tsx` -- version bump
- `src/components/ui/navigation.tsx` -- version bump
- `src/pages/VersionHistory.tsx` -- changelog entry

### Key code changes in `generate-song-audio/index.ts`:

1. After checking existing song (around line 48), add recovery logic:
```typescript
// Auto-recover: if song has audio_url but status is 'failed', fix it
if (existingSong?.audio_url && existingSong?.audio_generation_status === 'failed') {
  await supabase.from('songs')
    .update({ audio_generation_status: 'completed' })
    .eq('id', songId);
  return new Response(
    JSON.stringify({ 
      error: "Song already has generated audio. Status has been recovered to completed.",
      recovered: true 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}
```

2. In the lyrics saving section (line 294), add an additional guard:
```typescript
if (!hadOriginalLyrics && !existingSong?.audio_url) {
  // Only save if no original lyrics AND no existing audio
}
```

3. Improve `sanitizeLyrics` to handle more edge cases with flexible regex patterns.

