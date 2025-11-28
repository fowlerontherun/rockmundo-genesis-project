-- Seed 7 additional stage templates for Phase 2 (using correct size values)
INSERT INTO stage_templates (name, slug, size, capacity_min, capacity_max, camera_offset, metadata) VALUES
  (
    'Outdoor Amphitheater',
    'outdoor-amphitheater',
    'medium',
    500,
    2000,
    '{"x": 0, "y": 2.0, "z": 12}',
    '{
      "description": "Open-air venue with natural acoustics",
      "intensity": 0.7,
      "spotlights": [
        {"position": [-6, 10, -3], "color": "#ffaa00", "intensity": 2.5},
        {"position": [6, 10, -3], "color": "#ff6600", "intensity": 2.5},
        {"position": [0, 12, 0], "color": "#ffffff", "intensity": 3}
      ],
      "crowdZones": [
        {"name": "pit", "x": 0, "z": 6, "width": 8, "depth": 4, "density": 1.2, "minMood": 30},
        {"name": "floor", "x": 0, "z": 10, "width": 12, "depth": 6, "density": 1.0, "minMood": 20},
        {"name": "stands", "x": 0, "z": 16, "width": 16, "depth": 8, "density": 0.8, "minMood": 10}
      ]
    }'
  ),
  (
    'Underground Club',
    'underground-club',
    'small',
    30,
    100,
    '{"x": 0, "y": 1.7, "z": 5}',
    '{
      "description": "Intimate underground venue with raw energy",
      "intensity": 1.0,
      "spotlights": [
        {"position": [-2, 4, -2], "color": "#ff0066", "intensity": 3},
        {"position": [2, 4, -2], "color": "#6600ff", "intensity": 3}
      ],
      "crowdZones": [
        {"name": "pit", "x": 0, "z": 3, "width": 5, "depth": 3, "density": 1.5, "minMood": 40}
      ]
    }'
  ),
  (
    'Theater',
    'theater',
    'medium',
    300,
    1200,
    '{"x": 0, "y": 1.8, "z": 9}',
    '{
      "description": "Classic theater with tiered seating",
      "intensity": 0.6,
      "spotlights": [
        {"position": [0, 8, 2], "color": "#ffffff", "intensity": 2.5},
        {"position": [-4, 7, -1], "color": "#ffffaa", "intensity": 1.8},
        {"position": [4, 7, -1], "color": "#ffffaa", "intensity": 1.8}
      ],
      "crowdZones": [
        {"name": "orchestra", "x": 0, "z": 5, "width": 10, "depth": 4, "density": 1.0, "minMood": 20},
        {"name": "mezzanine", "x": 0, "z": 10, "width": 12, "depth": 5, "density": 0.7, "minMood": 10},
        {"name": "balcony", "x": 0, "z": 16, "width": 14, "depth": 4, "density": 0.5, "minMood": 5}
      ]
    }'
  ),
  (
    'Stadium',
    'stadium',
    'large',
    20000,
    80000,
    '{"x": 0, "y": 2.5, "z": 20}',
    '{
      "description": "Massive outdoor stadium for major events",
      "intensity": 0.8,
      "spotlights": [
        {"position": [-10, 15, -5], "color": "#ffffff", "intensity": 4},
        {"position": [10, 15, -5], "color": "#ffffff", "intensity": 4},
        {"position": [0, 18, 0], "color": "#ffaa00", "intensity": 5}
      ],
      "crowdZones": [
        {"name": "pit", "x": 0, "z": 12, "width": 20, "depth": 8, "density": 1.3, "minMood": 40},
        {"name": "floor", "x": 0, "z": 22, "width": 30, "depth": 12, "density": 1.1, "minMood": 30},
        {"name": "lower_stands", "x": 0, "z": 35, "width": 40, "depth": 15, "density": 0.9, "minMood": 20},
        {"name": "upper_stands", "x": 0, "z": 50, "width": 50, "depth": 20, "density": 0.6, "minMood": 10}
      ]
    }'
  ),
  (
    'Beach Festival Stage',
    'beach-festival',
    'large',
    8000,
    40000,
    '{"x": 0, "y": 2.2, "z": 18}',
    '{
      "description": "Open-air beach festival with sunset vibes",
      "intensity": 0.9,
      "spotlights": [
        {"position": [-8, 12, -4], "color": "#ff6600", "intensity": 3.5},
        {"position": [8, 12, -4], "color": "#ffaa00", "intensity": 3.5},
        {"position": [0, 14, 0], "color": "#ffffff", "intensity": 4}
      ],
      "crowdZones": [
        {"name": "pit", "x": 0, "z": 10, "width": 16, "depth": 6, "density": 1.3, "minMood": 35},
        {"name": "floor", "x": 0, "z": 18, "width": 25, "depth": 10, "density": 1.0, "minMood": 25},
        {"name": "back", "x": 0, "z": 30, "width": 35, "depth": 15, "density": 0.7, "minMood": 15}
      ]
    }'
  ),
  (
    'Rooftop Bar',
    'rooftop-bar',
    'small',
    50,
    150,
    '{"x": 0, "y": 1.7, "z": 6}',
    '{
      "description": "Intimate rooftop venue with city views",
      "intensity": 0.5,
      "spotlights": [
        {"position": [-3, 5, -2], "color": "#ff00aa", "intensity": 2},
        {"position": [3, 5, -2], "color": "#00aaff", "intensity": 2}
      ],
      "crowdZones": [
        {"name": "floor", "x": 0, "z": 4, "width": 6, "depth": 4, "density": 1.1, "minMood": 25}
      ]
    }'
  ),
  (
    'Historic Opera House',
    'opera-house',
    'large',
    1500,
    4000,
    '{"x": 0, "y": 2.0, "z": 10}',
    '{
      "description": "Grand historic venue with ornate architecture",
      "intensity": 0.65,
      "spotlights": [
        {"position": [0, 10, 3], "color": "#ffffdd", "intensity": 3},
        {"position": [-5, 9, 0], "color": "#ffddaa", "intensity": 2.2},
        {"position": [5, 9, 0], "color": "#ffddaa", "intensity": 2.2}
      ],
      "crowdZones": [
        {"name": "orchestra", "x": 0, "z": 6, "width": 12, "depth": 5, "density": 1.0, "minMood": 20},
        {"name": "dress_circle", "x": 0, "z": 12, "width": 14, "depth": 6, "density": 0.8, "minMood": 15},
        {"name": "grand_tier", "x": 0, "z": 19, "width": 16, "depth": 7, "density": 0.6, "minMood": 10},
        {"name": "balcony", "x": 0, "z": 27, "width": 18, "depth": 6, "density": 0.4, "minMood": 5}
      ]
    }'
  );