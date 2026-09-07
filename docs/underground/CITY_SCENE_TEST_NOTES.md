# City Scene Test Notes

Live database verification for the city-scene refinement pass:

- `player_scene_contacts.city_id` exists.
- `trg_track_city_scene_arrival` is installed on completed travel updates.
- `city_underground_scenes`, `player_city_scene_reputation`, and `city_scene_rivalries` expose SELECT only to authenticated clients.
- `get_current_city_scene` and `discover_scene_contacts` are the only new client-callable routines in this refinement; internal trigger routines are not executable by authenticated/anon roles.
- Rivalry pressure only reduces local reputation gain by one point (minimum gain remains one); it does not reduce Scene Story success chance or hard-block content.
