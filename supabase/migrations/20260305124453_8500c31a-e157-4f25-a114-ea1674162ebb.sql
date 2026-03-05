
-- 1. Remove streaming platform quality restrictions
UPDATE streaming_platforms SET min_quality_requirement = 0 WHERE min_quality_requirement > 0;

-- 2. Normalize radio station genres and expand coverage
-- First, create a helper function to normalize and expand genres
DO $$
DECLARE
  station RECORD;
  new_genres TEXT[];
  genre TEXT;
  normalized TEXT;
BEGIN
  FOR station IN SELECT id, accepted_genres FROM radio_stations LOOP
    new_genres := '{}';
    
    IF station.accepted_genres IS NULL OR array_length(station.accepted_genres, 1) IS NULL THEN
      CONTINUE;
    END IF;
    
    FOREACH genre IN ARRAY station.accepted_genres LOOP
      -- Normalize genre names to match MUSIC_GENRES
      normalized := CASE lower(trim(genre))
        WHEN 'hip_hop' THEN 'Hip Hop'
        WHEN 'hip-hop' THEN 'Hip Hop'
        WHEN 'hip hop' THEN 'Hip Hop'
        WHEN 'r_and_b' THEN 'R&B'
        WHEN 'r&b' THEN 'R&B'
        WHEN 'rnb' THEN 'R&B'
        WHEN 'pop' THEN 'Pop'
        WHEN 'rock' THEN 'Rock'
        WHEN 'country' THEN 'Country'
        WHEN 'electronic' THEN 'Electronica'
        WHEN 'electronica' THEN 'Electronica'
        WHEN 'dance' THEN 'EDM'
        WHEN 'edm' THEN 'EDM'
        WHEN 'indie' THEN 'Indie/Bedroom Pop'
        WHEN 'metal' THEN 'Heavy Metal'
        WHEN 'heavy metal' THEN 'Heavy Metal'
        WHEN 'punk' THEN 'Punk Rock'
        WHEN 'punk rock' THEN 'Punk Rock'
        WHEN 'jazz' THEN 'Jazz'
        WHEN 'blues' THEN 'Blues'
        WHEN 'folk' THEN 'Country'
        WHEN 'soul' THEN 'R&B'
        WHEN 'funk' THEN 'R&B'
        WHEN 'gospel' THEN 'R&B'
        WHEN 'trap' THEN 'Trap'
        WHEN 'grime' THEN 'Grime'
        WHEN 'world' THEN 'World Music'
        WHEN 'world music' THEN 'World Music'
        WHEN 'latin' THEN 'Latin'
        WHEN 'reggaeton' THEN 'Latin'
        WHEN 'salsa' THEN 'Latin'
        WHEN 'reggae' THEN 'Reggae'
        WHEN 'dancehall' THEN 'Reggae'
        WHEN 'afrobeat' THEN 'Afrobeats/Amapiano'
        WHEN 'afrobeats' THEN 'Afrobeats/Amapiano'
        WHEN 'afrobeats/amapiano' THEN 'Afrobeats/Amapiano'
        WHEN 'classical' THEN 'Classical'
        WHEN 'alternative' THEN 'Indie/Bedroom Pop'
        WHEN 'adult contemporary' THEN 'Pop'
        WHEN 'experimental' THEN 'Electronica'
        WHEN 'ambient' THEN 'Electronica'
        WHEN 'techno' THEN 'EDM'
        WHEN 'house' THEN 'EDM'
        WHEN 'surf' THEN 'Rock'
        WHEN 'acoustic' THEN 'Country'
        WHEN 'singer-songwriter' THEN 'Indie/Bedroom Pop'
        WHEN 'lo-fi hip hop' THEN 'Lo-Fi Hip Hop'
        WHEN 'lo-fi' THEN 'Lo-Fi Hip Hop'
        WHEN 'synthwave' THEN 'Synthwave'
        WHEN 'african music' THEN 'African Music'
        WHEN 'modern rock' THEN 'Modern Rock'
        WHEN 'alt r&b/neo-soul' THEN 'Alt R&B/Neo-Soul'
        WHEN 'indie/bedroom pop' THEN 'Indie/Bedroom Pop'
        WHEN 'k-pop/j-pop' THEN 'K-Pop/J-Pop'
        WHEN 'metalcore/djent' THEN 'Metalcore/Djent'
        WHEN 'hyperpop' THEN 'Hyperpop'
        ELSE initcap(trim(genre))
      END;
      
      -- Add normalized genre if not already present
      IF normalized IS NOT NULL AND NOT (new_genres @> ARRAY[normalized]) THEN
        new_genres := array_append(new_genres, normalized);
      END IF;
    END LOOP;
    
    -- Now expand: add related subgenres
    -- Hip Hop stations get hip hop subgenres
    IF new_genres @> ARRAY['Hip Hop'] THEN
      FOREACH genre IN ARRAY ARRAY['Boom Bap', 'Conscious Rap', 'Gangsta Rap', 'Trap', 'Drill', 'Cloud Rap', 'Mumble Rap', 'Emo Rap', 'Jazz Rap', 'Phonk', 'Crunk', 'Grime', 'Lo-Fi Hip Hop'] LOOP
        IF NOT (new_genres @> ARRAY[genre]) THEN
          new_genres := array_append(new_genres, genre);
        END IF;
      END LOOP;
    END IF;
    
    -- Rock/Metal stations get rock subgenres
    IF new_genres @> ARRAY['Rock'] OR new_genres @> ARRAY['Heavy Metal'] THEN
      FOREACH genre IN ARRAY ARRAY['Punk Rock', 'Modern Rock', 'Metalcore/Djent', 'Rock'] LOOP
        IF NOT (new_genres @> ARRAY[genre]) THEN
          new_genres := array_append(new_genres, genre);
        END IF;
      END LOOP;
    END IF;
    
    -- Pop/EDM stations get pop subgenres
    IF new_genres @> ARRAY['Pop'] OR new_genres @> ARRAY['EDM'] THEN
      FOREACH genre IN ARRAY ARRAY['K-Pop/J-Pop', 'Hyperpop'] LOOP
        IF NOT (new_genres @> ARRAY[genre]) THEN
          new_genres := array_append(new_genres, genre);
        END IF;
      END LOOP;
    END IF;
    
    -- Electronic stations get electronic subgenres
    IF new_genres @> ARRAY['Electronica'] OR new_genres @> ARRAY['EDM'] THEN
      FOREACH genre IN ARRAY ARRAY['Synthwave', 'Lo-Fi Hip Hop', 'Electronica', 'EDM'] LOOP
        IF NOT (new_genres @> ARRAY[genre]) THEN
          new_genres := array_append(new_genres, genre);
        END IF;
      END LOOP;
    END IF;
    
    -- World Music stations get world subgenres
    IF new_genres @> ARRAY['World Music'] THEN
      FOREACH genre IN ARRAY ARRAY['Flamenco', 'African Music', 'Latin', 'Reggae', 'Afrobeats/Amapiano'] LOOP
        IF NOT (new_genres @> ARRAY[genre]) THEN
          new_genres := array_append(new_genres, genre);
        END IF;
      END LOOP;
    END IF;
    
    -- R&B stations get R&B subgenres
    IF new_genres @> ARRAY['R&B'] THEN
      FOREACH genre IN ARRAY ARRAY['Alt R&B/Neo-Soul'] LOOP
        IF NOT (new_genres @> ARRAY[genre]) THEN
          new_genres := array_append(new_genres, genre);
        END IF;
      END LOOP;
    END IF;
    
    -- Jazz stations get Jazz Rap
    IF new_genres @> ARRAY['Jazz'] THEN
      IF NOT (new_genres @> ARRAY['Jazz Rap']) THEN
        new_genres := array_append(new_genres, 'Jazz Rap');
      END IF;
      IF NOT (new_genres @> ARRAY['Blues']) THEN
        new_genres := array_append(new_genres, 'Blues');
      END IF;
    END IF;
    
    -- Blues stations get Jazz
    IF new_genres @> ARRAY['Blues'] THEN
      IF NOT (new_genres @> ARRAY['Jazz']) THEN
        new_genres := array_append(new_genres, 'Jazz');
      END IF;
    END IF;
    
    -- Latin stations get Reggae, Flamenco
    IF new_genres @> ARRAY['Latin'] THEN
      FOREACH genre IN ARRAY ARRAY['Reggae', 'Flamenco'] LOOP
        IF NOT (new_genres @> ARRAY[genre]) THEN
          new_genres := array_append(new_genres, genre);
        END IF;
      END LOOP;
    END IF;
    
    -- Update the station
    UPDATE radio_stations SET accepted_genres = new_genres WHERE id = station.id;
    
  END LOOP;
END $$;
