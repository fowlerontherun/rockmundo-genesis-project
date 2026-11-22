import * as T from "three";
import { seededRandom } from "./config";
import type { VenueProfile } from "./venueProfile";
import type { FestivalSeasonalAtmosphere } from "@/features/festival-company/domain/festivalSeasonalAtmosphere";

/** Bounded, display-only outdoor dressing; all assets are owned by the scene's cleanup. */
export function buildFestivalOutdoorAtmosphere(scene: T.Scene, profile: VenueProfile, atmosphere: FestivalSeasonalAtmosphere,
  daylight: boolean, seed: number, token: (name: string) => string) {
  const color = (name: string) => new T.Color(token(name));
  const wet = atmosphere.ground === "mud";
  const overcast = ["cloudy", "rainy", "stormy", "snowy"].includes(atmosphere.condition ?? "");
  const sky = color(daylight ? overcast ? "overcast" : `${atmosphere.season}-sky` : "night");
  scene.background = sky;
  const environment = scene.getObjectByName(`environment-${profile.kind}`);
  const surfaces = environment?.userData.outdoorSurfaces as {
    sky: T.MeshBasicMaterial; ground: T.MeshStandardMaterial; foliage: T.MeshStandardMaterial;
  } | undefined;
  if (surfaces) {
    surfaces.sky.color.copy(sky);
    surfaces.ground.color.copy(color(atmosphere.ground === "snow" ? "snow" : wet ? "mud" : `${atmosphere.season}-ground`));
    surfaces.ground.roughness = wet ? .38 : .95;
    surfaces.foliage.color.copy(color(`${atmosphere.season}-foliage`));
  }
  const root = new T.Group(); root.name = "festival-seasonal-dressing"; scene.add(root);
  const accent = new T.MeshStandardMaterial({ color: color("accent"), side: T.DoubleSide });
  const lamps = new T.MeshStandardMaterial({ color: color("lamp"), emissive: color("lamp"), emissiveIntensity: daylight ? .25 : 1.5 });
  // Side-stage bunting and winter festoon lamps stay outside performance and camera lanes.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const x = side * (profile.stageWidth / 2 + 1.5 + i * .8);
      const y = profile.rigHeight * .7 - Math.sin(i / 7 * Math.PI) * .5;
      const flag = new T.Mesh(new T.ConeGeometry(.24, .5, 3), accent);
      flag.position.set(x, y, .5 - profile.stageDepth); flag.rotation.z = Math.PI; root.add(flag);
      const bulb = new T.Mesh(new T.SphereGeometry(.075, 6, 4), lamps);
      bulb.position.set(x, y + .4, .5 - profile.stageDepth); root.add(bulb);
    }
  }
  const random = seededRandom(seed);
  const precipitation = atmosphere.condition === "snowy" || atmosphere.condition === "rainy" || atmosphere.condition === "stormy";
  const count = precipitation ? 160 : 0;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) positions.set([
    (random() - .5) * profile.roomWidth, random() * 14, 2 + random() * Math.min(profile.crowdDepth, 35),
  ], i * 3);
  const geometry = new T.BufferGeometry(); geometry.setAttribute("position", new T.BufferAttribute(positions.slice(), 3));
  const snow = atmosphere.condition === "snowy";
  const particles = new T.Points(geometry, new T.PointsMaterial({ color: color(snow ? "snow" : "rain"),
    size: snow ? .09 : .035, transparent: true, opacity: .65, depthWrite: false }));
  particles.name = "festival-weather-particles"; root.add(particles);
  return {
    sky,
    update(seconds: number, reducedMotion: boolean) {
      particles.visible = precipitation && !reducedMotion;
      if (!particles.visible) return;
      const speed = snow ? .8 : 6;
      for (let i = 0; i < count; i++) {
        const offset = i * 3;
        geometry.attributes.position.setY(i, ((positions[offset + 1] - seconds * speed) % 14 + 14) % 14);
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}